require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

console.log('🔄 Starting Data Migration: SQLite → PostgreSQL\n');

// 1. Source: SQLite (local)
console.log('📁 Connecting to SQLite (source)...');
const sqliteDb = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: false
});

// 2. Destination: PostgreSQL (Railway)
if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable not set!');
    console.log('\nSet it to your Railway Postgres connection string:');
    console.log('Example: postgresql://postgres:password@host.railway.app:5432/railway\n');
    process.exit(1);
}

console.log('🐘 Connecting to PostgreSQL (destination)...');
const postgresDb = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false
});

// Define models for both databases
function defineModels(sequelize) {
    const Invoice = sequelize.define('Invoice', {
        entity: { type: DataTypes.STRING, allowNull: false, defaultValue: 'zloty_gron' },
        invoiceNumber: { type: DataTypes.STRING, allowNull: false },
        contractorName: { type: DataTypes.STRING, allowNull: true },
        contractorNIP: { type: DataTypes.STRING, allowNull: true },
        contractorAddress: { type: DataTypes.STRING, allowNull: true },
        netAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        vatAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        grossAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        currency: { type: DataTypes.STRING, defaultValue: 'PLN' },
        issueDate: { type: DataTypes.DATEONLY, allowNull: true },
        saleDate: { type: DataTypes.DATEONLY, allowNull: true },
        paymentDate: { type: DataTypes.DATEONLY, allowNull: true },
        accountNumber: { type: DataTypes.STRING, allowNull: true },
        paymentMethod: { type: DataTypes.STRING, allowNull: true },
        status: { type: DataTypes.ENUM('unpaid', 'paid', 'partial'), defaultValue: 'unpaid' },
        filePath: { type: DataTypes.STRING, allowNull: true },
        category: { type: DataTypes.STRING, allowNull: true },
        raw_ai_data: { type: DataTypes.JSON, allowNull: true }
    });

    const Settlement = sequelize.define('Settlement', {
        entity: { type: DataTypes.STRING, allowNull: false, defaultValue: 'zloty_gron' },
        fileName: { type: DataTypes.STRING, allowNull: false },
        uploadDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        totalProcessed: { type: DataTypes.INTEGER, defaultValue: 0 },
        status: { type: DataTypes.ENUM('pending', 'processing', 'processed', 'error'), defaultValue: 'pending' },
        paymentsData: { type: DataTypes.JSON, allowNull: true }
    });

    const History = sequelize.define('History', {
        entity: { type: DataTypes.STRING, allowNull: true },
        action: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true }
    });

    return { Invoice, Settlement, History };
}

async function migrate() {
    try {
        // Test connections
        console.log('\n📡 Testing database connections...');
        await sqliteDb.authenticate();
        console.log('  ✅ SQLite connected');

        await postgresDb.authenticate();
        console.log('  ✅ PostgreSQL connected\n');

        // Define models
        const sourceModels = defineModels(sqliteDb);
        const destModels = defineModels(postgresDb);

        // Sync destination database (create tables)
        console.log('🔧 Creating tables in PostgreSQL...');
        await postgresDb.sync({ force: false, alter: true });
        console.log('  ✅ Tables created\n');

        // Migrate Invoices
        console.log('📦 Migrating Invoices...');
        const invoices = await sourceModels.Invoice.findAll();
        console.log(`  Found ${invoices.length} invoices in SQLite`);

        if (invoices.length > 0) {
            for (const invoice of invoices) {
                await destModels.Invoice.create(invoice.toJSON());
            }
            console.log(`  ✅ Migrated ${invoices.length} invoices\n`);
        } else {
            console.log('  ⚠️  No invoices to migrate\n');
        }

        // Migrate Settlements
        console.log('📦 Migrating Settlements...');
        const settlements = await sourceModels.Settlement.findAll();
        console.log(`  Found ${settlements.length} settlements in SQLite`);

        if (settlements.length > 0) {
            for (const settlement of settlements) {
                await destModels.Settlement.create(settlement.toJSON());
            }
            console.log(`  ✅ Migrated ${settlements.length} settlements\n`);
        } else {
            console.log('  ⚠️  No settlements to migrate\n');
        }

        // Migrate History
        console.log('📦 Migrating History...');
        const history = await sourceModels.History.findAll();
        console.log(`  Found ${history.length} history records in SQLite`);

        if (history.length > 0) {
            for (const record of history) {
                await destModels.History.create(record.toJSON());
            }
            console.log(`  ✅ Migrated ${history.length} history records\n`);
        } else {
            console.log('  ⚠️  No history to migrate\n');
        }

        // Verification
        console.log('🔍 Verifying migration...');
        const destInvoiceCount = await destModels.Invoice.count();
        const destSettlementCount = await destModels.Settlement.count();
        const destHistoryCount = await destModels.History.count();

        console.log(`\n📊 Migration Summary:`);
        console.log(`  Invoices: ${invoices.length} → ${destInvoiceCount} ${invoices.length === destInvoiceCount ? '✅' : '❌'}`);
        console.log(`  Settlements: ${settlements.length} → ${destSettlementCount} ${settlements.length === destSettlementCount ? '✅' : '❌'}`);
        console.log(`  History: ${history.length} → ${destHistoryCount} ${history.length === destHistoryCount ? '✅' : '❌'}`);

        if (invoices.length === destInvoiceCount &&
            settlements.length === destSettlementCount &&
            history.length === destHistoryCount) {
            console.log('\n🎉 Migration completed successfully!\n');
        } else {
            console.log('\n⚠️  Warning: Record counts do not match. Please verify manually.\n');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await sqliteDb.close();
        await postgresDb.close();
    }
}

// Run migration
migrate();
