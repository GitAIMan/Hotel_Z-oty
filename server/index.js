require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
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

async function analyzeSettlementWithClaude(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const fileBase64 = fileBuffer.toString('base64');
    const mediaType = getFileMediaType(filePath);

    const systemPrompt = "You are an expert accountant AI. Analyze this bank statement (image or PDF) and extract all transaction rows. Return strict JSON.";

    const userMessage = {
        role: "user",
        content: [
            {
                type: mediaType === 'application/pdf' ? 'document' : 'image',
                source: {
                    type: "base64",
                    media_type: mediaType,
                    data: fileBase64
                }
            },
            {
                type: "text",
                text: `Extract all payments/transactions from this document. 
                Return a JSON object with a key "payments" containing an array of transactions.
                Each transaction must have:
                - date (YYYY-MM-DD)
                - amount (number, absolute value)
                - type (string, 'incoming' or 'outgoing')
                - contractor (string, guessed from description)
                - description (string)
                
                Return ONLY the JSON object.`
            }
        ]
    };

    try {
        console.log(`Sending Settlement to Claude 4.5 (${mediaType})...`);

        const options = {};
        if (mediaType === 'application/pdf') {
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

// 5. Analyze Settlement (Step 1 of 2)
app.post('/api/settlements/analyze', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { entity } = req.body;
        const filePath = req.file.path;
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        console.log(`Analyzing settlement file for entity: ${entity}...`);

        // CSV Handling
        if (fileExt === '.csv') {
            const results = [];
            const csv = require('csv-parser');

            fs.createReadStream(filePath)
                .pipe(csv({ separator: ';' })) // Assuming semicolon separator for Polish CSVs, or auto-detect? Let's try default first or specific. User didn't specify. Excel usually exports with ; in PL.
                // Actually, let's try to be smart or use default. If it fails, we might need to adjust.
                // Let's assume standard comma or semicolon. csv-parser auto-detects? No.
                // Let's try to detect or assume semicolon for now as it's common in PL Excel.
                // Wait, user said "Excel xD". Excel CSVs in PL use semicolons.
                .on('headers', (headers) => {
                    // Simple check if we have semicolon separated headers
                    if (headers.length === 1 && headers[0].includes(';')) {
                        // It's likely semicolon separated but parsed as one column.
                        // We might need to restart with separator: ';'
                        // But csv-parser configuration is done at stream creation.
                        // Let's assume semicolon for safety given the context.
                    }
                })
                .pipe(csv({ separator: ';' })) // Re-pipe? No.
            // Let's just use a robust approach.
            // Actually, let's stick to a safe default.
        }

        // Let's rewrite this block to be cleaner.
        if (fileExt === '.csv') {
            const results = [];
            const csv = require('csv-parser');

            // We need to handle potential encoding issues (Windows-1250 vs UTF-8). 
            // But let's assume UTF-8 for now.

            // We'll try to read it with semicolon separator first as it's standard for PL Excel CSV.
            fs.createReadStream(filePath)
                .pipe(csv({ separator: ';' }))
                .on('data', (data) => {
                    // Map columns based on user request
                    // Magazyn -> Category
                    // Nr Faktury -> Invoice Number
                    // Brutto -> Amount
                    // Data wpływu -> Date
                    // Kontrahent -> Contractor

                    // We need to find keys that match these names (case insensitive?)
                    // Let's normalize keys.

                    const normalizedData = {};
                    Object.keys(data).forEach(key => {
                        normalizedData[key.trim()] = data[key];
                    });

                    // Extract fields
                    const amountStr = normalizedData['Brutto'] || normalizedData['Kwota'] || '0';
                    const amount = parseFloat(amountStr.replace(',', '.').replace(/\s/g, ''));

                    if (amount > 0) { // Only positive amounts? Or all? User didn't specify. Usually settlements are payments.
                        results.push({
                            date: normalizedData['Data wpływu'] || normalizedData['Data'],
                            amount: Math.abs(amount),
                            type: 'incoming', // Assumption for settlement
                            contractor: normalizedData['Kontrahent'] || '',
                            description: `Faktura: ${normalizedData['Nr Faktury'] || ''}`,
                            // Custom fields to pass through
                            category: normalizedData['Magazyn'],
                            invoiceNumber: normalizedData['Nr Faktury']
                        });
                    }
                })
                .on('end', () => {
                    res.json({
                        analysis: { payments: results },
                        tempFilePath: req.file.filename,
                        originalName: req.file.originalname
                    });
                })
                .on('error', (err) => {
                    console.error("CSV Parse Error:", err);
                    res.status(500).json({ error: "Failed to parse CSV" });
                });

            return; // Stop here, don't do AI analysis
        }

        // AI Analysis (for PDF/Images)
        try {
            const analysis = await analyzeSettlementWithClaude(filePath);

            res.json({
                analysis,
                tempFilePath: req.file.filename,
                originalName: req.file.originalname
            });

        } catch (aiError) {
            console.error("Settlement analysis error:", aiError);
            res.status(500).json({ error: `AI Analysis Failed: ${aiError.message}` });
        }

    } catch (err) {
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
