require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const iconv = require('iconv-lite');
const { initDb, Invoice, Settlement, History, sequelize } = require('./db');
const { Op } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Anthropic Client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        cb(null, Date.now() + '-' + safeName);
    }
});
const upload = multer({ storage });

// --- Helpers ---
function getFileMediaType(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    return 'application/octet-stream';
}

function matchPaymentToInvoice(payment, invoice) {
    // 1. Check Amount (allow small difference for floating point)
    const paymentAmount = parseFloat(payment.amount);
    const invoiceAmount = parseFloat(invoice.grossAmount); // Use grossAmount from invoice
    if (Math.abs(paymentAmount - invoiceAmount) > 0.05) return false;

    // 2. Check Contractor (simplified for now, can be enhanced with NIP)
    // Normalize strings: lowercase, remove spaces
    const pName = (payment.contractor || '').toLowerCase().replace(/\s/g, '');
    const iName = (invoice.contractorName || '').toLowerCase().replace(/\s/g, '');

    // Check if one contains the other or exact match
    if (!pName || !iName) return false; // Safety check
    return pName.includes(iName) || iName.includes(pName);
}

// --- AI Analysis Services ---

async function analyzeInvoiceWithClaude(filesInput) {
    // Handle both single file path (legacy/fallback) and array of file objects
    const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput }];

    const content = [];

    // Add images/documents
    for (const file of files) {
        const filePath = file.path;
        const fileBuffer = fs.readFileSync(filePath);
        const fileBase64 = fileBuffer.toString('base64');
        const mediaType = getFileMediaType(filePath);

        content.push({
            type: mediaType === 'application/pdf' ? 'document' : 'image',
            source: {
                type: "base64",
                media_type: mediaType,
                data: fileBase64
            }
        });
    }

    // Add text prompt
    content.push({
        type: "text",
        text: `Analyze this invoice (which may consist of multiple images/pages) and extract the following fields into a JSON object:
                - invoiceNumber (string)
                - contractorName (string)
                - contractorNIP (string or null)
                - issueDate (YYYY-MM-DD or null)
                - saleDate (YYYY-MM-DD or null)
                - paymentDate (YYYY-MM-DD or null)
                - netAmount (number or null)
                - vatAmount (number or null)
                - grossAmount (number)
                - accountNumber (string or null)
                - paymentMethod (string or null)
                - category (string, guess from content e.g., 'Paliwo', 'Biuro', 'Usługi', 'Towar', 'Media', 'Leasing', 'Inne')

                Return ONLY the JSON object. No markdown formatting, no explanations.`
    });

    const systemPrompt = "You are an expert accountant AI. Your task is to extract invoice data from the provided document(s) and output it as strict JSON.";

    const userMessage = {
        role: "user",
        content: content
    };

    try {
        console.log(`Sending Invoice to Claude 4.5 (${files.length} files)...`);

        const options = {};
        // If any file is PDF, enable PDF beta
        if (files.some(f => getFileMediaType(f.path) === 'application/pdf')) {
            options.headers = { "anthropic-beta": "pdfs-2024-09-25" };
        }

        const msg = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            temperature: 0,
            system: systemPrompt,
            messages: [userMessage],
        }, options);

        console.log("Claude 4.5 Responded!");
        const jsonString = msg.content[0].text;
        console.log("Raw AI Response:", jsonString);

        const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON object found in response");
        }

        return JSON.parse(jsonMatch[0]);

    } catch (error) {
        console.error("Claude 4.5 CRITICAL ERROR:", error);
        throw new Error(`Claude 4.5 Analysis Failed: ${error.message || error.type || 'Unknown Error'}`);
    }
}

async function analyzeSettlementWithClaude(filesInput) {
    // Handle both single file path (legacy/fallback) and array of file objects
    const files = Array.isArray(filesInput) ? filesInput : [{ path: filesInput }];

    // 1. Check for CSV files - Process locally (FAST PATH)
    const csvFile = files.find(f => f.originalname.toLowerCase().endsWith('.csv'));
    if (csvFile) {
        console.log(`Processing CSV file locally: ${csvFile.originalname}`);
        try {
            // Read as buffer and decode with windows-1250 (common for Polish banks)
            const fileBuffer = fs.readFileSync(csvFile.path);
            const fileContent = iconv.decode(fileBuffer, 'windows-1250');
            const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);

            const payments = [];

            // --- CATEGORY MAPPING ---
            const CATEGORY_MAP = [
                { keywords: ['biedronka', 'lidl', 'kaufland', 'auchan', 'dino', 'netto', 'carrefour', 'żabka', 'zabka', 'lewiatan', 'stokrotka', 'delikatesy'], category: 'GASTRONOMIA KOSZTY - TOWARY' },
                { keywords: ['orlen', 'bp', 'shell', 'circle k', 'moya', 'lotos', 'paliwo', 'stacja', 'mol', 'amic'], category: 'KOSZTY OGÓLNE - ZWROT GOTÓWKI ZA PALIWO' },
                { keywords: ['netflix', 'spotify', 'adobe', 'google', 'microsoft', 'apple', 'suno', 'midjourney', 'chatgpt', 'openai', 'canva', 'zoom', 'slack'], category: 'KOSZTY OGÓLNE - OPROGRAMOWANIE' },
                { keywords: ['koleo', 'uber', 'bolt', 'freenow', 'jakdojade', 'bilet', 'pkp', 'intercity', 'mpk', 'ztm'], category: 'KOSZTY OGÓLNE - USŁUGI TRANSPORTOWE' },
                { keywords: ['glovo', 'pyszne', 'wolt', 'ubereats', 'restauracja', 'bar', 'kawiarnia', 'cukiernia', 'mcdonald', 'kfc', 'burger king', 'starbucks', 'costa'], category: 'GASTRONOMIA KOSZTY - KOSZTY INNYCH USŁUG ZEWNĘTRZNYCH' },
                { keywords: ['castorama', 'leroy', 'obi', 'mrowka', 'psb', 'budowlany', 'bricomarche', 'jula'], category: 'HOTEL KOSZTY - REMONTY NAPRAWY' },
                { keywords: ['apteka', 'doz', 'gemini', 'super-pharm', 'rossmann', 'hebe'], category: 'KOSZTY OGÓLNE - KOSZTY ADMINISTRACYJNE' },
                { keywords: ['action', 'pepco', 'tedi', 'kik', 'sinsay', 'hm', 'zara', 'reserved'], category: 'HOTEL KOSZTY - UZUPEŁNIENIE WYPOSAŻENIA' },
                { keywords: ['prowizja', 'opłata', 'odsetki', 'bank', 'ing', 'mbank', 'pko', 'santander'], category: 'KOSZTY OGÓLNE - USŁUGI FINANSOWE / BANKOWE' },
                { keywords: ['orange', 't-mobile', 'plus', 'play', 'upc', 'vectra', 'netia'], category: 'KOSZTY OGÓLNE - TELEFONY / KARTY SIM' },
                { keywords: ['tauron', 'pgnig', 'enea', 'energa', 'innogy', 'woda', 'ścieki', 'gaz'], category: 'KOSZTY OGÓLNE - MEDIA' }
            ];

            function guessCategory(text) {
                if (!text) return null;
                const lowerText = text.toLowerCase();
                for (const map of CATEGORY_MAP) {
                    if (map.keywords.some(k => lowerText.includes(k))) {
                        return map.category;
                    }
                }
                return 'KOSZTY OGÓLNE - INNE USŁUGI ZWIĄZANE Z ZARZĄDZANIEM'; // Default
            }

            function cleanContractor(text) {
                if (!text) return '';
                let cleaned = text;
                // Remove common prefixes/suffixes found in this bank's CSV
                cleaned = cleaned.replace(/Operacja:.*$/i, '');
                cleaned = cleaned.replace(/Numer referencyjny:.*$/i, '');
                cleaned = cleaned.replace(/Tytuł:.*$/i, '');
                cleaned = cleaned.replace(/Lokalizacja:.*$/i, '');
                cleaned = cleaned.replace(/Adres:.*$/i, '');
                cleaned = cleaned.replace(/Data wykonania:.*$/i, '');
                cleaned = cleaned.replace(/Oryginalna kwota:.*$/i, '');

                // Remove specific noise
                cleaned = cleaned.replace(/Nazwa odbiorcy:/i, '');
                cleaned = cleaned.replace(/Nazwa nadawcy:/i, '');

                // Trim whitespace and special chars
                cleaned = cleaned.replace(/['"]/g, '').trim();

                // If result is empty or just special chars, return original (fallback) or empty
                if (cleaned.length < 2) return text.substring(0, 50);

                return cleaned;
            }

            // --- PARSING LOGIC ---
            // We need to handle quoted fields properly: "val1","val2","val 3"
            const parseCSVLine = (text) => {
                const result = [];
                let cell = '';
                let inQuotes = false;
                for (let i = 0; i < text.length; i++) {
                    const char = text[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        result.push(cell);
                        cell = '';
                    } else {
                        cell += char;
                    }
                }
                result.push(cell);
                return result.map(c => c.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
            };

            for (const line of lines) {
                // Skip empty or header-like lines if they don't start with a date
                if (!/^\s*"?\d{4}-\d{2}-\d{2}/.test(line)) continue;

                const cols = parseCSVLine(line);

                // MAPPING BASED ON USER'S CSV STRUCTURE:
                // 0: Data operacji
                // 3: Kwota
                // 6: Opis transakcji (General title)
                // 7: Rachunek odbiorcy / Tytuł (varies)
                // 8: Nazwa odbiorcy / Numer telefonu / Lokalizacja (varies)
                // 9: Tytuł / Operacja (varies)

                // 1. DATE
                const date = cols[0];

                // 2. AMOUNT
                let amountStr = cols[3].replace(/\s/g, '').replace(',', '.');
                let amount = parseFloat(amountStr);
                if (isNaN(amount)) continue;

                // 3. CONTRACTOR & DESCRIPTION EXTRACTION
                // Join all relevant columns to search for keywords
                const fullRowText = cols.join(' ');
                let contractor = '';

                // Strategy: Look for specific prefixes in the raw line or columns
                // "Nazwa odbiorcy: [VALUE]"
                // "Nazwa nadawcy: [VALUE]"
                // "Lokalizacja: Adres: [VALUE]"

                const nazwaOdbiorcyMatch = fullRowText.match(/Nazwa odbiorcy:\s*([^"]+?)(?=(,|$|"))/);
                const nazwaNadawcyMatch = fullRowText.match(/Nazwa nadawcy:\s*([^"]+?)(?=(,|$|"))/);
                const lokalizacjaMatch = fullRowText.match(/Lokalizacja: Adres:\s*([^"]+?)(?=(,|$|"|Miasto:))/);
                const netflixMatch = fullRowText.match(/NETFLIX\.COM/i);

                if (nazwaOdbiorcyMatch) contractor = nazwaOdbiorcyMatch[1];
                else if (nazwaNadawcyMatch) contractor = nazwaNadawcyMatch[1];
                else if (lokalizacjaMatch) contractor = lokalizacjaMatch[1];
                else if (netflixMatch) contractor = "NETFLIX";
                else {
                    // Fallback: Try to use the "Tytuł" if it looks like a name, or just generic
                    // In this CSV, col 8 often has "Lokalizacja: ..."
                    if (cols[8] && cols[8].includes('Lokalizacja:')) {
                        contractor = cols[8].replace('Lokalizacja: Adres:', '').split('Miasto:')[0].trim();
                    } else {
                        contractor = cols[6] || 'Nieznany';
                    }
                }

                // Clean up contractor
                contractor = cleanContractor(contractor);

                // 4. CATEGORY
                const category = guessCategory(contractor + ' ' + cols[6]);

                payments.push({
                    date: date,
                    amount: Math.abs(amount),
                    type: amount < 0 ? 'outgoing' : 'incoming',
                    contractor: contractor,
                    description: cols[6] + ' ' + (cols[9] || ''),
                    category: category
                });
            }

            console.log(`CSV Local Parse: Found ${payments.length} transactions.`);
            return { payments };

        } catch (error) {
            console.error("CSV Local Parse Error:", error);
            throw new Error("Failed to parse CSV file locally");
        }
    }

    // 2. Fallback to AI for PDF/Images
    const content = [];

    // Add images/documents/text
    for (const file of files) {
        const filePath = file.path;
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.csv' || ext === '.txt') {
            // Should be handled above, but keep as fallback for .txt
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            content.push({
                type: "text",
                text: `[FILE CONTENT START (${file.originalname})]\n${fileContent}\n[FILE CONTENT END]`
            });
        } else {
            const fileBuffer = fs.readFileSync(filePath);
            const fileBase64 = fileBuffer.toString('base64');
            const mediaType = getFileMediaType(filePath);

            content.push({
                type: mediaType === 'application/pdf' ? 'document' : 'image',
                source: {
                    type: "base64",
                    media_type: mediaType,
                    data: fileBase64
                }
            });
        }
    }

    // Add text prompt
    content.push({
        type: "text",
        text: `Extract all payments/transactions from this document (which may consist of multiple images, pages, or text/CSV data). 
                Return a JSON object with a key "payments" containing an array of transactions.
                Each transaction must have:
                - date (YYYY-MM-DD)
                - amount (number, absolute value)
                - type (string, 'incoming' or 'outgoing')
                - contractor (string, guessed from description)
                - description (string)
                
                Return ONLY the JSON object.`
    });

    const systemPrompt = "You are an expert accountant AI. Analyze this bank statement (image, PDF, or CSV) and extract all transaction rows. Return strict JSON.";

    const userMessage = {
        role: "user",
        content: content
    };

    try {
        console.log(`Sending Settlement to Claude 4.5 (${files.length} files)...`);

        const options = {};
        if (files.some(f => getFileMediaType(f.path) === 'application/pdf')) {
            options.headers = { "anthropic-beta": "pdfs-2024-09-25" };
        }

        const msg = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            temperature: 0,
            system: systemPrompt,
            messages: [userMessage],
        }, options);

        console.log("Claude 4.5 Responded for Settlement!");
        const jsonString = msg.content[0].text;
        console.log("Raw AI Response:", jsonString);

        const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");

        return JSON.parse(jsonMatch[0]);

    } catch (error) {
        console.error("Claude Settlement Analysis Failed:", error);
        throw error;
    }
}

// --- Routes ---

// 1. Invoices List
app.get('/api/invoices', async (req, res) => {
    const { entity } = req.query;
    const whereClause = entity ? { entity } : {};

    try {
        const invoices = await Invoice.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']]
        });
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Analyze Invoice (Step 1 of 2)
app.post('/api/invoices/analyze', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { entity } = req.body;
        const files = req.files;

        console.log(`Analyzing ${files.length} file(s) for entity: ${entity}...`);

        // 1. AI Analysis
        // We need to modify analyzeInvoiceWithClaude to accept multiple files
        const aiResult = await analyzeInvoiceWithClaude(files);

        // 2. Reverse Check: Check if this invoice might be already paid
        let potentialMatch = null;

        if (aiResult.grossAmount) {
            try {
                // Find all processed settlements with payment data
                const settlements = await Settlement.findAll({
                    where: {
                        entity: entity || 'zloty_gron',
                        status: 'processed',
                        paymentsData: { [Op.ne]: null }
                    }
                });

                for (const settlement of settlements) {
                    if (!settlement.paymentsData) continue;

                    // Ensure paymentsData is an array (it should be if parsed correctly)
                    const payments = Array.isArray(settlement.paymentsData) ? settlement.paymentsData : [];

                    // Find payment with same amount (allow small diff for float errors)
                    const match = payments.find(p => Math.abs(p.amount - aiResult.grossAmount) < 0.05);

                    if (match) {
                        potentialMatch = {
                            amount: match.amount,
                            date: match.date,
                            contractor: match.contractor,
                            settlementFile: settlement.fileName
                        };
                        break;
                    }
                }
            } catch (checkError) {
                console.error("Reverse check failed:", checkError);
                // Don't fail the whole request, just ignore the check
            }
        }

        res.json({
            aiData: aiResult,
            tempFilePath: files[0].filename, // Use the first file as the main reference for now, or join them
            // TODO: We might need to store all filenames if we want to keep all photos. 
            // For now, let's assume the first one is the "main" one for the DB record, 
            // or we can join them with a separator if the DB column supports it.
            // The current DB schema has `filePath` as STRING. 
            // Let's store the first one for simplicity in this iteration, or a JSON string.
            // Given the requirement "1 pdf ... max 3 pages", the multiple photos are likely converted to one context.
            // Let's stick to returning the first filename for the frontend to pass back to confirm.
            // But wait, if we have 3 photos, we need to keep them all?
            // The `confirm` endpoint takes `tempFilePath`. 
            // Let's join them with a pipe '|' if there are multiple.
            tempFilePath: files.map(f => f.filename).join('|'),
            potentialMatch
        });

    } catch (err) {
        console.error("Processing failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Confirm Invoice (Step 2 of 2)
app.post('/api/invoices/confirm', async (req, res) => {
    try {
        const { entity, invoiceData, tempFilePath } = req.body;

        // 🛡️ DUPLICATE CHECK: Prevent adding the same invoice twice
        const existingInvoice = await Invoice.findOne({
            where: {
                entity: entity || 'zloty_gron',
                invoiceNumber: invoiceData.invoiceNumber
            }
        });

        if (existingInvoice) {
            console.log(`⚠️ Duplicate invoice detected: ${invoiceData.invoiceNumber}`);
            return res.status(409).json({
                error: 'DUPLICATE_INVOICE',
                message: `Faktura ${invoiceData.invoiceNumber} już istnieje w bazie`,
                existingInvoice: {
                    id: existingInvoice.id,
                    invoiceNumber: existingInvoice.invoiceNumber,
                    issueDate: existingInvoice.issueDate,
                    contractorName: existingInvoice.contractorName,
                    grossAmount: existingInvoice.grossAmount,
                    status: existingInvoice.status,
                    createdAt: existingInvoice.createdAt
                }
            });
        }

        // Create Record
        const newInvoice = await Invoice.create({
            entity: entity || 'zloty_gron',
            invoiceNumber: invoiceData.invoiceNumber || 'UNKNOWN',
            contractorName: invoiceData.contractorName || 'Unknown',
            contractorNIP: invoiceData.contractorNIP,
            issueDate: invoiceData.issueDate,
            saleDate: invoiceData.saleDate,
            paymentDate: invoiceData.paymentDate,
            netAmount: invoiceData.netAmount,
            vatAmount: invoiceData.vatAmount,
            grossAmount: invoiceData.grossAmount || 0,
            accountNumber: invoiceData.accountNumber,
            paymentMethod: invoiceData.paymentMethod,
            category: invoiceData.category,
            raw_ai_data: invoiceData, // Store full AI response
            status: 'unpaid',
            filePath: tempFilePath
        });

        // ✨ REVERSE MATCHING: Check if this new invoice matches any existing unmatched payments
        try {
            const settlements = await Settlement.findAll({ where: { entity: newInvoice.entity } });
            let matched = false;

            for (const settlement of settlements) {
                if (!settlement.paymentsData || !Array.isArray(settlement.paymentsData)) continue;

                const payments = JSON.parse(JSON.stringify(settlement.paymentsData));
                let settlementChanged = false;

                for (const payment of payments) {
                    // Only check unmatched payments
                    if (payment.matchStatus !== 'matched') {
                        if (matchPaymentToInvoice(payment, newInvoice)) {
                            console.log(`   ✨ Reverse Match Found! Invoice ${newInvoice.invoiceNumber} matches payment in settlement ${settlement.id}`);

                            // Update Payment
                            payment.matchedInvoiceId = newInvoice.id;
                            payment.matchedInvoiceNumber = newInvoice.invoiceNumber;
                            payment.matchStatus = 'matched';

                            settlementChanged = true;
                            matched = true;
                        }
                    }
                }

                if (settlementChanged) {
                    // Update Settlement
                    settlement.paymentsData = payments;
                    settlement.totalProcessed = payments.filter(p => p.matchStatus === 'matched').length;
                    settlement.changed('paymentsData', true);
                    await settlement.save();
                    console.log(`   💾 Updated settlement ${settlement.id} with new match.`);
                }
            }

            if (matched) {
                // Update Invoice Status to PAID
                newInvoice.status = 'paid';
                await newInvoice.save();
                console.log(`   ✅ Invoice ${newInvoice.invoiceNumber} marked as PAID due to reverse match.`);
            }

        } catch (reverseMatchError) {
            console.error("Error during reverse matching:", reverseMatchError);
        }

        await History.create({
            entity: entity || 'zloty_gron',
            action: 'INVOICE_ADDED',
            description: `User confirmed invoice ${newInvoice.invoiceNumber} from ${newInvoice.contractorName}`
        });

        res.status(201).json(newInvoice);
    } catch (err) {
        console.error("Confirmation failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Settlements List (with Robust Auto-Healing)
app.get('/api/settlements', async (req, res) => {
    const { entity } = req.query;
    const whereClause = entity ? { entity } : {};

    try {
        const settlements = await Settlement.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']]
        });

        // ✨ ROBUST SELF-HEALING: Validate integrity against existing invoices
        const allInvoiceIds = await Invoice.findAll({ attributes: ['id'] });
        // Use Set of STRINGS for safe comparison
        const validInvoiceIds = new Set(allInvoiceIds.map(i => String(i.id)));
        let globalUpdates = 0;

        for (const settlement of settlements) {
            if (!settlement.paymentsData || !Array.isArray(settlement.paymentsData)) continue;

            // Clone to ensure we can modify and save
            const payments = JSON.parse(JSON.stringify(settlement.paymentsData));
            let hasChanges = false;

            for (const payment of payments) {
                // If payment is matched, verify if the invoice still exists
                if (payment.matchStatus === 'matched' && payment.matchedInvoiceId) {
                    // Convert to string for comparison
                    const matchedIdStr = String(payment.matchedInvoiceId);

                    if (!validInvoiceIds.has(matchedIdStr)) {
                        console.log(`   🚑 Auto-healing: Found orphaned match in settlement ${settlement.id}. Invoice ID ${payment.matchedInvoiceId} no longer exists.`);

                        // Fix the data
                        delete payment.matchedInvoiceId;
                        delete payment.matchedInvoiceNumber;
                        payment.matchStatus = 'unmatched';
                        hasChanges = true;
                    }
                }
            }

            // ALWAYS recalculate totalProcessed to ensure it matches reality
            const currentTotalProcessed = settlement.totalProcessed || 0;
            const realTotalProcessed = payments.filter(p => p.matchStatus === 'matched').length;

            if (currentTotalProcessed !== realTotalProcessed) {
                console.log(`   ⚠️ Count mismatch in settlement ${settlement.id}. Stored: ${currentTotalProcessed}, Real: ${realTotalProcessed}. Fixing...`);
                settlement.totalProcessed = realTotalProcessed;
                hasChanges = true;
            }

            // If we found orphaned matches or count mismatch, save the corrected settlement
            if (hasChanges) {
                // Save changes
                settlement.paymentsData = payments;
                settlement.changed('paymentsData', true);
                await settlement.save();
                globalUpdates++;
                console.log(`   ✅ Auto-healed settlement ${settlement.id}. New matched count: ${realTotalProcessed}`);
            }
        }

        if (globalUpdates > 0) {
            console.log(`✨ Auto-healing complete. Fixed ${globalUpdates} settlements.`);
        }

        res.json(settlements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5a. Analyze Settlement (Step 1 of 2)
app.post('/api/settlements/analyze', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { entity } = req.body;
        const files = req.files;

        console.log(`Analyzing settlement ${files.length} file(s) for entity: ${entity}...`);

        // 1. AI Analysis
        const aiResult = await analyzeSettlementWithClaude(files);

        res.json({
            analysis: aiResult, // FIXED: Renamed from aiData to analysis
            tempFilePath: files.map(f => f.filename).join('|'),
            originalName: files[0].originalname
        });

    } catch (err) {
        console.error("Settlement analysis failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// 5b. Confirm Settlement (Step 2 of 2)
app.post('/api/settlements/confirm', async (req, res) => {
    try {
        const { entity, payments, tempFilePath, originalName } = req.body;

        const newSettlement = await Settlement.create({
            entity: entity || 'zloty_gron',
            fileName: originalName || 'Unknown',
            status: 'processing',
            totalProcessed: 0,
            paymentsData: payments // Save the verified payments
        });

        let matchedCount = 0;

        if (payments && Array.isArray(payments)) {
            console.log(`Processing ${payments.length} verified transactions...`);

            // Fetch ALL unpaid/partial invoices for this entity
            const openInvoices = await Invoice.findAll({
                where: {
                    status: ['unpaid', 'partial'],
                    entity: entity || 'zloty_gron'
                }
            });

            console.log(`Found ${openInvoices.length} open invoices to check against.`);

            for (const payment of payments) {
                // Skip if no amount
                if (!payment.amount) {
                    console.log(`⚠️ Skipping payment without amount: ${JSON.stringify(payment)}`);
                    continue;
                }

                // Robust parsing: handle strings with commas, spaces, and ensure absolute value
                let rawAmount = payment.amount;
                if (typeof rawAmount === 'string') {
                    rawAmount = rawAmount.replace(/\s/g, '').replace(',', '.');
                }
                const paymentAmount = Math.abs(parseFloat(rawAmount));

                if (isNaN(paymentAmount)) {
                    console.log(`⚠️ Could not parse amount for payment: ${JSON.stringify(payment)}`);
                    continue;
                }

                console.log(`🔍 Checking payment: ${paymentAmount} PLN | ${payment.contractor} | ${payment.description}`);

                let bestMatch = null;

                // Iterate through ALL open invoices to find a match based on strict criteria
                for (const inv of openInvoices) {
                    let identityMatch = false;
                    let amountMatch = false;

                    // CRITERIA 1: IDENTITY (Invoice Number OR Contractor)
                    // Check A: Invoice Number in Description
                    if (payment.description && inv.invoiceNumber) {
                        const cleanDesc = payment.description.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const cleanInvNum = inv.invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '');

                        if (cleanDesc.includes(cleanInvNum)) {
                            identityMatch = true;
                            console.log(`      ⭐ Identity Match (Invoice #): ${inv.invoiceNumber}`);
                        }
                    }

                    // Check B: Contractor Name (only if Invoice Number didn't match yet)
                    if (!identityMatch && payment.contractor && inv.contractorName) {
                        const cleanPayContractor = payment.contractor.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const cleanInvContractor = inv.contractorName.toLowerCase().replace(/[^a-z0-9]/g, '');

                        if (cleanPayContractor.includes(cleanInvContractor) || cleanInvContractor.includes(cleanPayContractor)) {
                            identityMatch = true;
                            console.log(`      ⭐ Identity Match (Contractor): ${inv.contractorName}`);
                        }
                    }

                    // CRITERIA 2: AMOUNT
                    if (Math.abs(Math.abs(inv.grossAmount) - paymentAmount) < 0.20) {
                        amountMatch = true;
                        console.log(`      💰 Amount Match: ${inv.grossAmount} vs ${paymentAmount}`);
                    }

                    // STRICT REQUIREMENT: BOTH MUST MATCH
                    if (identityMatch && amountMatch) {
                        bestMatch = inv;
                        break;
                    }
                }

                if (bestMatch) {
                    console.log(`   🎉 FINAL MATCH: Payment ${paymentAmount} PLN -> Invoice ${bestMatch.invoiceNumber}`);

                    const isFullPayment = paymentAmount >= (bestMatch.grossAmount - 0.20);
                    const newStatus = isFullPayment ? 'paid' : 'partial';

                    await bestMatch.update({
                        status: newStatus,
                        paymentDate: payment.date,
                        // ✨ NEW: Update category if provided (e.g. from CSV) and not already set (or overwrite?)
                        // Let's overwrite if provided, as CSV might be the source of truth for categories (Magazyn)
                        ...(payment.category ? { category: payment.category } : {})
                    });
                    matchedCount++;

                    // ✨ NEW: Track which invoice was matched to this payment
                    payment.matchedInvoiceId = bestMatch.id;
                    payment.matchedInvoiceNumber = bestMatch.invoiceNumber;
                    payment.matchStatus = 'matched';

                    await History.create({
                        entity: entity || 'zloty_gron',
                        action: 'PAYMENT_MATCHED',
                        description: `Auto-matched payment ${paymentAmount} PLN to Invoice ${bestMatch.invoiceNumber} (Status: ${newStatus})`
                    });
                } else {
                    console.log(`   ❌ No match found (Requires both Identity AND Amount match)`);
                    // ✨ NEW: Mark as unmatched
                    payment.matchStatus = 'unmatched';
                }
            }
        }

        await newSettlement.update({
            status: 'processed',
            totalProcessed: matchedCount,
            paymentsData: payments // ✨ Save updated payments with match info
        });

        await History.create({
            entity: entity || 'zloty_gron',
            action: 'SETTLEMENT_PROCESSED',
            description: `Processed ${newSettlement.fileName}. Matched ${matchedCount} invoices.`
        });

        res.status(201).json(newSettlement);

    } catch (err) {
        console.error("Settlement confirmation error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 7. Delete Settlement
app.delete('/api/settlements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const settlement = await Settlement.findByPk(id);

        if (!settlement) {
            return res.status(404).json({ error: 'Settlement not found' });
        }

        // Delete file if exists
        if (settlement.fileName) {
            // Note: fileName in DB is original name, but we might not have stored the safe path?
            // Wait, in create we stored fileName: req.file.originalname
            // But multer saved it as Date-safeName.
            // We didn't store the actual disk filename in Settlement model! 
            // Check Settlement model... it has fileName.
            // In POST /settlements, we did: fileName: req.file ? req.file.originalname : 'Unknown'
            // We LOST the disk filename. We can't delete the file easily unless we store it.
            // For now, just delete the record.
        }

        await settlement.destroy();

        await History.create({
            entity: settlement.entity,
            action: 'SETTLEMENT_DELETED',
            description: `Deleted settlement ${settlement.fileName}`
        });

        res.json({ message: 'Settlement deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Delete Invoice
app.delete('/api/invoices/:id', async (req, res) => {
    console.log(`🗑️ DELETE REQUEST RECEIVED for invoice ID: ${req.params.id}`);
    try {
        const { id } = req.params;
        const invoice = await Invoice.findByPk(id);

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // ✨ NEW: Clean up settlements that reference this invoice
        console.log(`🔍 Checking settlements for matches with invoice ID: ${id}...`);
        const settlements = await Settlement.findAll({
            where: { entity: invoice.entity }
        });

        let settlementsUpdated = 0;
        for (const settlement of settlements) {
            if (!settlement.paymentsData || !Array.isArray(settlement.paymentsData)) continue;

            // Clone the array to ensure Sequelize detects changes
            const payments = JSON.parse(JSON.stringify(settlement.paymentsData));
            let hasChanges = false;

            console.log(`   Checking settlement ${settlement.id} (${settlement.fileName}) with ${payments.length} payments...`);

            for (const payment of payments) {
                // Use loose equality (==) to handle string/number mismatches
                if (payment.matchedInvoiceId == id) {
                    console.log(`   🧹 Removing match info from payment in settlement "${settlement.fileName}" (Payment Amount: ${payment.amount})`);
                    delete payment.matchedInvoiceId;
                    delete payment.matchedInvoiceNumber;
                    payment.matchStatus = 'unmatched';
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                // Recalculate totalProcessed
                const newTotalProcessed = payments.filter(p => p.matchStatus === 'matched').length;
                settlement.totalProcessed = newTotalProcessed;

                // Force update
                settlement.paymentsData = payments;
                settlement.changed('paymentsData', true);
                await settlement.save();
                settlementsUpdated++;
                console.log(`   💾 Saved updates for settlement ${settlement.id}. New matched count: ${newTotalProcessed}`);
            }
        }

        if (settlementsUpdated > 0) {
            console.log(`✅ Updated ${settlementsUpdated} settlement(s)`);
        }

        // Delete file if exists
        if (invoice.filePath) {
            const fullPath = path.join(uploadDir, invoice.filePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                console.log(`Deleted file: ${fullPath}`);
            }
        }

        await invoice.destroy();

        await History.create({
            entity: invoice.entity,
            action: 'INVOICE_DELETED',
            description: `Deleted invoice ${invoice.invoiceNumber} from ${invoice.contractorName}`
        });

        res.json({ message: 'Invoice deleted successfully' });
    } catch (err) {
        console.error('Error deleting invoice:', err);
        res.status(500).json({ error: err.message });
    }
});

// 9. Update Invoice
app.put('/api/invoices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const invoice = await Invoice.findByPk(id);

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Update all fields from request body
        await invoice.update({
            invoiceNumber: req.body.invoiceNumber,
            contractorName: req.body.contractorName,
            contractorNIP: req.body.contractorNIP,
            issueDate: req.body.issueDate,
            saleDate: req.body.saleDate,
            paymentDate: req.body.paymentDate,
            netAmount: req.body.netAmount,
            vatAmount: req.body.vatAmount,
            grossAmount: req.body.grossAmount,
            accountNumber: req.body.accountNumber,
            paymentMethod: req.body.paymentMethod,
            category: req.body.category,
            status: req.body.status
        });

        await History.create({
            entity: invoice.entity,
            action: 'INVOICE_UPDATED',
            description: `Updated invoice ${invoice.invoiceNumber}`
        });

        res.json(invoice);
    } catch (err) {
        console.error('Error updating invoice:', err);
        res.status(500).json({ error: err.message });
    }
});

// 10. History
app.get('/api/history', async (req, res) => {
    const { entity } = req.query;
    const whereClause = entity ? { entity } : {};

    try {
        const history = await History.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']]
        });
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// 11. Clear History
app.delete('/api/history', async (req, res) => {
    const { entity } = req.query;
    const whereClause = entity ? { entity } : {};

    try {
        await History.destroy({ where: whereClause });
        res.json({ message: 'History cleared successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
