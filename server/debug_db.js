const { initDb, Invoice, Settlement, sequelize } = require('./db');
const fs = require('fs');

async function debugDatabase() {
    await initDb();
    let output = "";

    output += "=== INVOICES IN DATABASE ===\n";
    const invoices = await Invoice.findAll();
    if (invoices.length === 0) {
        output += "No invoices found.\n";
    } else {
        invoices.forEach(inv => {
            output += `ID: ${inv.id} | No: ${inv.invoiceNumber} | Contractor: ${inv.contractorName} | Gross: ${inv.grossAmount} | Status: ${inv.status}\n`;
        });
    }

    output += "\n=== SETTLEMENTS IN DATABASE ===\n";
    const settlements = await Settlement.findAll();
    if (settlements.length === 0) {
        output += "No settlements found.\n";
    } else {
        settlements.forEach(s => {
            output += `ID: ${s.id} | File: ${s.fileName} | Processed: ${s.totalProcessed} | Status: ${s.status}\n`;
            if (s.paymentsData) {
                output += "  Payments Data Sample: " + JSON.stringify(s.paymentsData, null, 2) + "\n";
            }
        });
    }

    fs.writeFileSync('debug_output.txt', output);
    console.log("Debug output written to debug_output.txt");
}

debugDatabase().catch(console.error);
