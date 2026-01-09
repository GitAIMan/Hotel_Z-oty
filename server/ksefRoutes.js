/**
 * KSeF Routes - Pobieranie faktur z Krajowego Systemu e-Faktur
 * 
 * Endpoints:
 * - GET  /api/ksef/status   - Status tokenu
 * - POST /api/ksef/refresh  - Odśwież token ręcznie
 * - POST /api/ksef/invoices - Pobierz faktury z KSeF
 * - POST /api/ksef/import   - Zaimportuj wybrane faktury do bazy
 * - POST /api/ksef/check-duplicates - Sprawdź duplikaty przed importem
 */

const express = require('express');
const https = require('https');
const crypto = require('crypto');
const { Invoice, History } = require('./db');

const router = express.Router();

// KSeF Test Environment
const KSEF_HOST = 'ksef-test.mf.gov.pl';
const KSEF_BASE = '/api';

// Token storage (in memory - Railway doesn't persist files)
let tokenStorage = {
    accessToken: null,
    validUntil: null,
    sessionToken: null,
    lastAuthTime: null
};

// --- Helper: Make HTTPS request to KSeF API ---
function ksefRequest(endpoint, method, body, token = null) {
    return new Promise((resolve, reject) => {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        if (token) {
            headers['SessionToken'] = token;
        }

        const options = {
            hostname: KSEF_HOST,
            path: KSEF_BASE + endpoint,
            method: method,
            headers: headers
        };

        console.log(`📡 KSeF Request: ${method} ${KSEF_BASE}${endpoint}`);

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`📡 KSeF Response: ${res.statusCode}`);
                if (res.statusCode && res.statusCode < 400) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data); // Some endpoints return non-JSON
                    }
                } else {
                    console.error(`❌ KSeF Error: ${data}`);
                    reject({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', (err) => {
            console.error(`❌ KSeF Network Error: ${err.message}`);
            reject(err);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// --- Helper: Check if token is still valid ---
function isTokenValid() {
    if (!tokenStorage.sessionToken || !tokenStorage.validUntil) {
        return false;
    }
    const validUntil = new Date(tokenStorage.validUntil);
    const now = new Date();
    // Add 1 minute buffer
    return validUntil > new Date(now.getTime() + 60000);
}

// --- Helper: Full authentication flow ---
async function authenticate() {
    const NIP = process.env.KSEF_TEST_NIP;
    const TOKEN = process.env.KSEF_TEST_TOKEN;

    if (!NIP || !TOKEN) {
        throw new Error('Brak KSEF_TEST_NIP lub KSEF_TEST_TOKEN w zmiennych środowiskowych');
    }

    console.log('🔐 Starting KSeF authentication...');

    // Step 1: Get public key for encryption
    const certsResponse = await ksefRequest('/online/Session/AuthorisationChallenge', 'POST', {
        contextIdentifier: {
            type: 'onip',
            identifier: NIP
        }
    });

    const challenge = certsResponse.challenge;
    const timestamp = certsResponse.timestamp;

    console.log(`🔑 Got challenge: ${challenge.substring(0, 20)}...`);

    // Step 2: Get the encryption certificate
    const publicKeyResponse = await ksefRequest('/online/Session/AuthorisationCertificatePem', 'GET', null);

    // Step 3: Encrypt the token
    const tokenToEncrypt = `${TOKEN}|${new Date(timestamp).getTime()}`;
    const publicKey = crypto.createPublicKey(publicKeyResponse);

    const encrypted = crypto.publicEncrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        Buffer.from(tokenToEncrypt)
    );

    // Step 4: Initialize session with encrypted token
    const initResponse = await ksefRequest('/online/Session/InitToken', 'POST', {
        context: {
            contextIdentifier: {
                type: 'onip',
                identifier: NIP
            },
            contextName: {
                type: 'onip',
                tradeName: 'Hotel Złoty Groń'
            }
        },
        init: {
            identifier: {
                type: 'onip',
                identifier: NIP
            },
            type: 'token',
            token: encrypted.toString('base64'),
            challenge: challenge
        }
    });

    // Store session data
    tokenStorage = {
        sessionToken: initResponse.sessionToken?.token,
        validUntil: initResponse.sessionToken?.context?.contextExpirationMoment,
        referenceNumber: initResponse.referenceNumber,
        lastAuthTime: new Date().toISOString()
    };

    console.log(`✅ KSeF authenticated! Valid until: ${tokenStorage.validUntil}`);

    return {
        success: true,
        validUntil: tokenStorage.validUntil,
        lastAuthTime: tokenStorage.lastAuthTime
    };
}

// --- GET /status - Check token status ---
router.get('/status', (req, res) => {
    if (isTokenValid()) {
        const validUntil = new Date(tokenStorage.validUntil).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        const lastAuth = tokenStorage.lastAuthTime
            ? new Date(tokenStorage.lastAuthTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
            : '?';

        res.json({
            connected: true,
            validUntil: tokenStorage.validUntil,
            lastAuthTime: tokenStorage.lastAuthTime,
            message: `Aktywny (odświeżono: ${lastAuth} | ważne do: ${validUntil})`
        });
    } else {
        res.json({
            connected: false,
            message: 'Brak aktywnej sesji KSeF'
        });
    }
});

// --- POST /refresh - Manually refresh token ---
router.post('/refresh', async (req, res) => {
    try {
        if (isTokenValid()) {
            const validUntil = new Date(tokenStorage.validUntil).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            const lastAuth = tokenStorage.lastAuthTime
                ? new Date(tokenStorage.lastAuthTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
                : '?';

            return res.json({
                success: true,
                alreadyValid: true,
                validUntil: tokenStorage.validUntil,
                lastAuthTime: tokenStorage.lastAuthTime,
                message: `Token aktywny (odświeżono: ${lastAuth} | ważne do: ${validUntil})`
            });
        }

        const result = await authenticate();
        const validUntil = new Date(result.validUntil).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        const lastAuth = new Date(result.lastAuthTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

        res.json({
            success: true,
            validUntil: result.validUntil,
            lastAuthTime: result.lastAuthTime,
            message: `Token aktywny (odświeżono: ${lastAuth} | ważne do: ${validUntil})`
        });
    } catch (err) {
        console.error('❌ KSeF refresh error:', err);
        res.status(500).json({
            error: err.message || 'Błąd odświeżania tokenu KSeF'
        });
    }
});

// --- POST /invoices - Fetch invoices from KSeF ---
router.post('/invoices', async (req, res) => {
    try {
        const { from, to } = req.body;

        if (!from || !to) {
            return res.status(400).json({ error: 'Wymagane pola: from, to (daty)' });
        }

        // Auto-refresh if token expired
        if (!isTokenValid()) {
            console.log('🔄 Token expired, auto-refreshing...');
            await authenticate();
        }

        // Query invoices from KSeF
        const fromDate = new Date(from).toISOString();
        const toDate = new Date(to).toISOString();

        console.log(`📥 Fetching invoices from ${fromDate} to ${toDate}`);

        const queryResult = await ksefRequest('/online/Query/Invoice/Sync?PageSize=100&PageOffset=0', 'POST', {
            queryCriteria: {
                subjectType: 'subject1',
                type: 'incremental',
                acquisitionTimestampThresholdFrom: fromDate,
                acquisitionTimestampThresholdTo: toDate
            }
        }, tokenStorage.sessionToken);

        // Map KSeF invoices to our format
        const invoices = (queryResult.invoiceHeaderList || []).map(inv => ({
            ksefReferenceNumber: inv.ksefReferenceNumber,
            invoiceNumber: inv.invoiceReferenceNumber || inv.ksefReferenceNumber,
            issueDate: inv.invoicingDate,
            contractorName: inv.subjectBy?.issuedByName || inv.subjectTo?.issuedToName || 'Nieznany',
            contractorNIP: inv.subjectBy?.issuedByIdentifier || inv.subjectTo?.issuedToIdentifier || '',
            grossAmount: inv.invoiceValueGross || 0,
            netAmount: inv.invoiceValueNet || 0,
            vatAmount: (inv.invoiceValueGross || 0) - (inv.invoiceValueNet || 0),
            currency: inv.currency || 'PLN'
        }));

        res.json({
            success: true,
            count: invoices.length,
            invoices: invoices,
            tokenValidUntil: tokenStorage.validUntil
        });

    } catch (err) {
        console.error('❌ KSeF invoices error:', err);
        res.status(500).json({
            error: err.message || 'Błąd pobierania faktur z KSeF'
        });
    }
});

// --- POST /check-duplicates - Check for existing invoices ---
router.post('/check-duplicates', async (req, res) => {
    try {
        const { invoices, entity } = req.body;

        if (!invoices || !Array.isArray(invoices)) {
            return res.status(400).json({ error: 'Wymagana lista faktur' });
        }

        const duplicates = [];
        const newInvoices = [];

        for (const inv of invoices) {
            // Check by KSeF reference number first
            let existing = null;

            if (inv.ksefReferenceNumber) {
                existing = await Invoice.findOne({
                    where: { ksefReferenceNumber: inv.ksefReferenceNumber }
                });
            }

            // If not found by KSeF ref, check by invoice number
            if (!existing && inv.invoiceNumber) {
                existing = await Invoice.findOne({
                    where: {
                        invoiceNumber: inv.invoiceNumber,
                        entity: entity || 'zloty_gron'
                    }
                });
            }

            if (existing) {
                duplicates.push({
                    ...inv,
                    existingId: existing.id,
                    existingData: {
                        id: existing.id,
                        invoiceNumber: existing.invoiceNumber,
                        contractorName: existing.contractorName,
                        grossAmount: existing.grossAmount,
                        status: existing.status,
                        createdAt: existing.createdAt
                    }
                });
            } else {
                newInvoices.push(inv);
            }
        }

        res.json({
            success: true,
            duplicates: duplicates,
            newInvoices: newInvoices,
            hasDuplicates: duplicates.length > 0
        });

    } catch (err) {
        console.error('❌ Check duplicates error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- POST /import - Import selected invoices to database ---
router.post('/import', async (req, res) => {
    try {
        const { invoices, entity, skipDuplicates } = req.body;

        if (!invoices || !Array.isArray(invoices)) {
            return res.status(400).json({ error: 'Wymagana lista faktur do importu' });
        }

        const imported = [];
        const skipped = [];
        const errors = [];

        for (const inv of invoices) {
            try {
                // Check for duplicates if not skipping
                if (!skipDuplicates) {
                    const existing = await Invoice.findOne({
                        where: { ksefReferenceNumber: inv.ksefReferenceNumber }
                    });

                    if (existing) {
                        skipped.push({ ...inv, reason: 'Duplikat (ref KSeF)' });
                        continue;
                    }
                }

                // Create new invoice
                const newInvoice = await Invoice.create({
                    entity: entity || 'zloty_gron',
                    invoiceNumber: inv.invoiceNumber || 'KSEF-' + inv.ksefReferenceNumber,
                    contractorName: inv.contractorName || 'Nieznany',
                    contractorNIP: inv.contractorNIP || '',
                    contractorAddress: inv.contractorAddress || '',
                    netAmount: inv.netAmount || null,
                    vatAmount: inv.vatAmount || null,
                    grossAmount: inv.grossAmount || 0,
                    currency: inv.currency || 'PLN',
                    issueDate: inv.issueDate || null,
                    saleDate: inv.saleDate || inv.issueDate || null,
                    paymentDate: inv.paymentDate || null,
                    status: 'unpaid',
                    source: 'ksef',
                    ksefReferenceNumber: inv.ksefReferenceNumber
                });

                imported.push(newInvoice);

                // Log to history
                await History.create({
                    entity: entity || 'zloty_gron',
                    action: 'KSEF_IMPORT',
                    description: `Zaimportowano fakturę ${inv.invoiceNumber} z KSeF (ref: ${inv.ksefReferenceNumber})`
                });

            } catch (invErr) {
                errors.push({ invoice: inv, error: invErr.message });
            }
        }

        res.json({
            success: true,
            imported: imported.length,
            skipped: skipped.length,
            errors: errors.length,
            details: {
                imported,
                skipped,
                errors
            }
        });

    } catch (err) {
        console.error('❌ KSeF import error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
