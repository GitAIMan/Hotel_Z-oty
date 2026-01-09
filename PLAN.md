# KSeF - Pobieranie Faktur z Krajowego Systemu e-Faktur

## Co to jest?

**KSeF** = rządowy system faktur elektronicznych (obowiązkowy od 2026).
Ta integracja dodaje panel na dashboardzie do pobierania faktur.

---

## Jak działa:

1. Kliknij **"📥 Pobierz"** → pobiera faktury z KSeF
2. Jeśli token wygasł → automatycznie się odnowi
3. Przycisk **"🔄 Odśwież"** → tylko gdy potrzebujesz nowego tokenu ręcznie

---

## Do `.env` (backend):

```
KSEF_TEST_NIP=8541952035
KSEF_TEST_TOKEN=20260108-EC-2F45E0E0-B2ECB0E268-72
```

---

## Backend: `routes/ksef.ts`

```typescript
import { Router, Request, Response } from 'express';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const router = Router();
const KSEF_HOST = 'api-test.ksef.mf.gov.pl';
const KSEF_BASE = '/v2';

function ksefRequest(endpoint: string, method: string, body: any, token?: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const headers: any = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const req = https.request({ hostname: KSEF_HOST, path: KSEF_BASE + endpoint, method, headers }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => res.statusCode && res.statusCode < 400 ? resolve(JSON.parse(data)) : reject({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Sprawdź czy token jest aktywny
function getTokenStatus(): { valid: boolean; validUntil?: string; token?: string } {
    const tokensPath = path.join(__dirname, '../ksef-tokens.json');
    try {
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        const validUntil = new Date(tokens.accessToken?.validUntil);
        if (tokens.accessToken?.token && validUntil > new Date()) {
            return { valid: true, validUntil: tokens.accessToken.validUntil, token: tokens.accessToken.token };
        }
    } catch {}
    return { valid: false };
}

// Pełne logowanie do KSeF
async function fullAuthentication(): Promise<{ validUntil: string }> {
    const authPath = path.join(__dirname, '../ksef-auth.json');
    const tokensPath = path.join(__dirname, '../ksef-tokens.json');
    const NIP = process.env.KSEF_TEST_NIP, TOKEN = process.env.KSEF_TEST_TOKEN;
    if (!NIP || !TOKEN) throw new Error('Brak KSEF_TEST_NIP lub KSEF_TEST_TOKEN w .env');

    const certs = await ksefRequest('/security/public-key-certificates', 'GET', null);
    const cert = certs.find((c: any) => c.usage?.includes('KsefTokenEncryption'));
    const publicKey = crypto.createPublicKey(`-----BEGIN CERTIFICATE-----\n${cert.certificate}\n-----END CERTIFICATE-----`);

    const challengeRes = await ksefRequest('/auth/challenge', 'POST', { contextIdentifier: { type: 'onip', identifier: NIP } });
    const timestamp = new Date(challengeRes.timestamp).getTime();
    const encrypted = crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(`${TOKEN}|${timestamp}`));

    const authRes = await ksefRequest('/auth/ksef-token', 'POST', { challenge: challengeRes.challenge, contextIdentifier: { type: 'nip', value: NIP }, encryptedToken: encrypted.toString('base64') });
    fs.writeFileSync(authPath, JSON.stringify(authRes, null, 2));

    const redeemRes = await ksefRequest('/auth/token/redeem', 'POST', {}, authRes.authenticationToken.token);
    fs.writeFileSync(tokensPath, JSON.stringify(redeemRes, null, 2));

    return { validUntil: redeemRes.accessToken.validUntil };
}

// Status tokenu
router.get('/status', async (req: Request, res: Response) => {
    const status = getTokenStatus();
    res.json(status.valid 
        ? { connected: true, validUntil: status.validUntil, message: `Token ważny do ${new Date(status.validUntil!).toLocaleTimeString()}` }
        : { connected: false, message: 'Token wygasł - kliknij Odśwież' });
});

// Pobierz faktury
router.post('/invoices', async (req: Request, res: Response) => {
    try {
        const { from, to } = req.body;
        let status = getTokenStatus();
        
        // Automatyczne odświeżenie jeśli wygasł
        if (!status.valid) {
            await fullAuthentication();
            status = getTokenStatus();
        }
        
        const result = await ksefRequest('/invoices/query/metadata?pageSize=100', 'POST', {
            subjectType: 'Subject1',
            dateRange: { dateType: 'PermanentStorage', from: new Date(from).toISOString(), to: new Date(to).toISOString() }
        }, status.token);
        
        res.json({ success: true, count: result.invoices?.length || 0, invoices: result.invoices || [] });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Ręczne odświeżenie tokenu
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const status = getTokenStatus();
        if (status.valid) {
            return res.json({ success: true, message: 'Token jest już aktywny', validUntil: status.validUntil, alreadyValid: true });
        }
        const result = await fullAuthentication();
        res.json({ success: true, validUntil: result.validUntil });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
```

---

## Backend: W Express dodaj:

```typescript
import ksefRouter from './routes/ksef';
app.use('/api/ksef', ksefRouter);
```

---

## Frontend: `KsefPanel.tsx`

```tsx
import { useState, useEffect } from 'react';

export default function KsefPanel() {
    const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().split('T')[0]; });
    const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string|null>(null);
    const [status, setStatus] = useState<string>('');
    const apiUrl = import.meta.env.VITE_API_URL || '';

    useEffect(() => { checkStatus(); }, []);

    const checkStatus = async () => {
        try {
            const r = await fetch(`${apiUrl}/api/ksef/status`);
            const d = await r.json();
            setStatus(d.message);
        } catch { setStatus('Brak połączenia'); }
    };

    const fetchInvoices = async () => {
        setLoading(true); setError(null); setResult(null);
        try {
            const r = await fetch(`${apiUrl}/api/ksef/invoices`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({from,to})});
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setResult(d);
            checkStatus();
        } catch(e:any) { setError(e.message); } finally { setLoading(false); }
    };

    const refresh = async () => {
        setLoading(true); setError(null);
        try {
            const r = await fetch(`${apiUrl}/api/ksef/refresh`, {method:'POST'});
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            if (d.alreadyValid) setStatus('Token już aktywny');
            else setStatus(`Token ważny do ${new Date(d.validUntil).toLocaleTimeString()}`);
        } catch(e:any) { setError(e.message); } finally { setLoading(false); }
    };

    return (
        <div style={{padding:'1rem',background:'#f5f5f5',borderRadius:'8px',margin:'1rem 0'}}>
            <h3 style={{margin:'0 0 0.5rem 0'}}>📄 Faktury z KSeF</h3>
            <small style={{color:'#666'}}>{status}</small>
            <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginTop:'0.5rem'}}>
                <input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
                <input type="date" value={to} onChange={e=>setTo(e.target.value)} />
                <button onClick={fetchInvoices} disabled={loading} style={{background:'#0066cc',color:'white',border:'none',padding:'0.5rem 1rem',borderRadius:'4px',cursor:'pointer'}}>{loading?'⏳...':'📥 Pobierz'}</button>
                <button onClick={refresh} disabled={loading} style={{background:'#28a745',color:'white',border:'none',padding:'0.5rem',borderRadius:'4px',cursor:'pointer'}}>🔄 Odśwież</button>
            </div>
            {error && <div style={{marginTop:'0.5rem',padding:'0.5rem',background:'#f8d7da',borderRadius:'4px',color:'#721c24'}}>❌ {error}</div>}
            {result && <div style={{marginTop:'0.5rem',padding:'0.5rem',background:'#cce5ff',borderRadius:'4px'}}>✅ Znaleziono: {result.count}</div>}
        </div>
    );
}
```

---

## Użycie w dashboardzie:

```tsx
import KsefPanel from './components/KsefPanel';

// Gdzieś w JSX:
<KsefPanel />
```

---

## Linki:
- API: https://api-test.ksef.mf.gov.pl/docs/v2/index.html
- Docs: https://github.com/CIRFMF/ksef-docs
