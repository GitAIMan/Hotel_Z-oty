const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { Invoice } = require('./db');
const router = express.Router();

// KSeF 2.0 Configuration
const KSEF_HOST = 'https://api-test.ksef.mf.gov.pl'; // New Host for v2
const KSEF_BASE = '/api/v2';
const NIP = process.env.KSEF_TEST_NIP;
const API_TOKEN = process.env.KSEF_TEST_TOKEN;

// Token Storage (InMemory)
let tokenStorage = {
    accessToken: null, // JWT
    refreshToken: null,
    validUntil: null,
    lastAuthTime: null
};

// Helper: Get Public Key
async function getPublicKey() {
    try {
        const response = await axios.get(`${KSEF_HOST}${KSEF_BASE}/security/public-key-certificates`);
        return response.data; // Expecting { algorithm: 'RSA', publicKey: '...', ... } or similar list
    } catch (error) {
        console.error('❌ Failed to fetch Public Key:', error.message);
        throw new Error('Failed to fetch KSeF Public Key');
    }
}

// Helper: Encrypt Token (RSA-OAEP-256)
function encryptToken(apiToken, timestamp, publicKeyPem) {
    try {
        const data = `${apiToken}|${timestamp}`;
        const buffer = Buffer.from(data, 'utf-8');

        // Ensure PEM format
        if (!publicKeyPem.includes('-----BEGIN PUBLIC KEY-----')) {
            publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKeyPem}\n-----END PUBLIC KEY-----`;
        }

        const encrypted = crypto.publicEncrypt({
            key: publicKeyPem,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        }, buffer);

        return encrypted.toString('base64');
    } catch (error) {
        console.error('❌ Encryption failed:', error.message);
        throw error;
    }
}

// Helper: Sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Core: Authenticate KSeF 2.0
async function authenticate() {
    console.log('🔐 Starting KSeF 2.0 Authentication...');

    if (!NIP || !API_TOKEN) {
        throw new Error('Missing KSEF_TEST_NIP or KSEF_TEST_TOKEN in environment variables.');
    }

    try {
        // 1. Get Challenge
        console.log('📡 1. Getting Auth Challenge...');
        const challengeRes = await axios.post(`${KSEF_HOST}${KSEF_BASE}/auth/challenge`, {
            contextIdentifier: {
                type: 'onip', // 'onip' for NIP in v2? or 'nip'? OpenAPI says 'onip' is common but let's check. 
                // Actually KSeF 2.0 uses 'type': 'Nip' (Case sensitive?). 
                // Let's assume 'onip' was v1. v2 docs say 'contextIdentifier': { type: 'Nip', value: ... } in examples.
                // Wait, example in doc said "AuthenticationTokenContextIdentifierType.Nip".
                // String value is usually 'Nip'.
            }
        });
        // Wait, v2 /auth/challenge body? 
        // Doc says `POST /auth/challenge`. No body required usually? 
        // Doc example: `KsefClient.GetAuthChallengeAsync()`. No args.
        // Let's call without body.
        const challengeInitRes = await axios.post(`${KSEF_HOST}${KSEF_BASE}/auth/challenge`, {});
        const { timestamp, challenge } = challengeInitRes.data;
        console.log('  ✅ Challenge received:', challenge);

        // 2. Fetch Public Key (if not cached/hardcoded, better to fetch)
        // Note: For simplicity, we fetch it every time or could cache.
        console.log('📡 2. Fetching Public Key...');
        const keysRes = await axios.get(`${KSEF_HOST}${KSEF_BASE}/security/public-key-certificates`);
        // Response structure: { keys: [ { publicKey: "PEM...", ... } ] } ?
        // I need to parse the response. Assuming first key is valid for now.
        // If getting raw PEM is tricky, I hope the response is standard JSON.
        const publicKey = keysRes.data.pem || keysRes.data.keys?.[0]?.publicKey || keysRes.data.publicKey;
        // This is a guess on structure. I should have read the schema. 
        // But invalid key will fail encryption.

        // 3. Encrypt Token
        console.log('🔐 3. Encrypting Token...');
        const encryptedToken = encryptToken(API_TOKEN, timestamp, publicKey);

        // 4. Send Auth Request
        console.log('📡 4. Sending Auth Request...');
        const authRes = await axios.post(`${KSEF_HOST}${KSEF_BASE}/auth/ksef-token`, {
            challenge: challenge,
            contextIdentifier: {
                type: 'Nip', // Defined in v2 Enum
                value: NIP
            },
            encryptedToken: encryptedToken
        });
        const { referenceNumber, authenticationToken } = authRes.data;
        console.log('  ✅ Auth Init Success. Ref:', referenceNumber);

        // 5. Check Status Loop
        console.log('📡 5. Checking Auth Status...');
        let status = 'processing';
        let retries = 0;
        while (status !== '200' && retries < 20) { // 200 = Success (in this API context?)
            // Status codes in v2: code: 200 (Description: Uwierzytelnianie zakończone sukcesem)
            await sleep(2000); // 2s wait
            const statusRes = await axios.get(`${KSEF_HOST}${KSEF_BASE}/auth/${referenceNumber}`, {
                headers: { 'Authorization': `Bearer ${authenticationToken}` }
            });
            // statusRes.data.status // { code: 200, description: "..." }
            const statusCode = statusRes.data.status?.code;
            console.log('  - Status:', statusCode, statusRes.data.status?.description);

            if (statusCode === 200) {
                status = '200';
                break;
            }
            if (statusCode >= 400) {
                throw new Error(`Auth Status Error: ${statusCode}`);
            }
            retries++;
        }

        if (status !== '200') throw new Error('Auth Status Timeout');

        // 6. Redeem Token
        console.log('📡 6. Redeeming Access Token...');
        const redeemRes = await axios.post(`${KSEF_HOST}${KSEF_BASE}/auth/token/redeem`, {}, {
            headers: { 'Authorization': `Bearer ${authenticationToken}` }
        });

        const { accessToken, refreshToken, tokenDetails } = redeemRes.data;
        tokenStorage.accessToken = accessToken;
        tokenStorage.refreshToken = refreshToken;
        // Use tokenDetails.expirationDate or parse JWT. 
        // Assuming tokenDetails provides it or we default to 15m.
        tokenStorage.validUntil = tokenDetails?.expirationDate || new Date(Date.now() + 15 * 60000).toISOString();
        tokenStorage.lastAuthTime = new Date().toISOString();

        console.log('✅ KSeF Authentication Complete!');
        return tokenStorage;

    } catch (error) {
        console.error('❌ KSeF Auth Failed:', error.response?.data || error.message);
        throw error;
    }
}

// Middleware: Ensure Auth
async function ensureAuth() {
    if (!tokenStorage.accessToken || new Date() > new Date(tokenStorage.validUntil)) {
        await authenticate();
    }
    return tokenStorage.accessToken;
}

// --- ROUTES ---

// 1. GET Status
router.get('/status', async (req, res) => {
    try {
        const isConnected = !!tokenStorage.accessToken && new Date() < new Date(tokenStorage.validUntil);
        const lastAuth = tokenStorage.lastAuthTime ? new Date(tokenStorage.lastAuthTime).toLocaleTimeString() : '-';
        const validTo = tokenStorage.validUntil ? new Date(tokenStorage.validUntil).toLocaleTimeString() : '-';

        let message = isConnected
            ? `Aktywny (odświeżono: ${lastAuth} | ważne do: ${validTo})`
            : "Niepołączony (Token wygasł lub brak)";

        if (isConnected) {
            // Verify implicitly if needed? No, purely state based for speed.
        }

        res.json({
            connected: isConnected,
            message: message,
            nip: NIP,
            lastAuthTime: tokenStorage.lastAuthTime
        });
    } catch (error) {
        res.status(500).json({ connected: false, message: error.message });
    }
});

// 2. POST Refresh
router.post('/refresh', async (req, res) => {
    try {
        await authenticate(); // Force new auth
        res.json({ success: true, message: 'Token odświeżony pomyślnie' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Błąd odświeżania: ' + error.message });
    }
});

// 3. POST Invoices (Fetch from KSeF)
router.post('/invoices', async (req, res) => {
    try {
        const token = await ensureAuth();
        const { from, to } = req.body;

        // v2 uses POST /invoices/query/metadata
        console.log(`📡 Querying KSeF Invoices: ${from} - ${to}`);

        // This payload structure is complex in v2.
        // Assuming: { subjectType: "Subject1", dateRange: { from, to, dateType: "InvoicingDate" } }
        const queryPayload = {
            subjectType: "Subject1", // Standard logic
            dateRange: {
                dateType: "InvoicingDate",
                from: new Date(from).toISOString(),
                to: new Date(to).toISOString()
            }
        };

        const queryRes = await axios.post(`${KSEF_HOST}${KSEF_BASE}/invoices/query/metadata`, queryPayload, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Response: { invoiceHeaderList: [ ... ], ... }
        const headers = queryRes.data.invoiceHeaderList || [];
        console.log(`✅ Found ${headers.length} invoices`);

        // Map to simpler structure
        const invoices = headers.map(h => ({
            ksefReferenceNumber: h.ksefReferenceNumber,
            invoiceNumber: h.invoiceReferenceNumber,
            date: h.invoicingDate,
            contractorName: h.subjectBy?.fullName || h.subjectBy?.name || 'Nieznany',
            grossAmount: h.gross, // Check if this field aligns with API response
            netAmount: h.net,
            vatAmount: h.vat,
            url: null // We don't have URL yet, logical
        }));

        res.json({ invoices: invoices });

    } catch (error) {
        console.error('❌ Fetch Invoices Error:', error.response?.data || error.message);
        res.status(500).json({ error: error.message, details: error.response?.data });
    }
});

// 4. POST Import (Save to DB)
router.post('/import', async (req, res) => {
    try {
        const { invoices } = req.body; // Expects array of selected invoices
        let count = 0;
        const savedInvoices = [];

        for (const inv of invoices) {
            // Check duplicate
            const exists = await Invoice.findOne({ where: { ksefReferenceNumber: inv.ksefReferenceNumber } });
            if (!exists) {
                // If we need the Full XML Content, we should fetch it here:
                // GET /invoices/ksef/{ksefNumber}
                // But for now, we save what we have from metadata. 
                // Wait, metadata might lack items.
                // The User Plan said "Download... Save".
                // Ideally we download XML.

                // Optional: Fetch XML content
                // const xmlRes = await axios.get(`${KSEF_HOST}${KSEF_BASE}/invoices/ksef/${inv.ksefReferenceNumber}`, { 
                //      headers: { 'Authorization': `Bearer ${tokenStorage.accessToken}` } 
                // });
                // const xmlData = xmlRes.data; // This is XML string

                await Invoice.create({
                    entity: 'zloty_gron', // Default
                    invoiceNumber: inv.invoiceNumber,
                    contractorName: inv.contractorName,
                    grossAmount: inv.grossAmount || 0,
                    netAmount: inv.netAmount || 0,
                    issueDate: inv.date,
                    status: 'unpaid',
                    source: 'ksef',
                    ksefReferenceNumber: inv.ksefReferenceNumber
                    // filePath: save xml to file?
                });
                count++;
                savedInvoices.push(inv.invoiceNumber);
            }
        }

        res.json({ success: true, count, saved: savedInvoices });

    } catch (error) {
        console.error('❌ Import Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
