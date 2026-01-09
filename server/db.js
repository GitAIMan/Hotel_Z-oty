const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Initialize database - PostgreSQL (production) or SQLite (local dev)
let sequelize;

if (process.env.DATABASE_URL) {
  // Production: PostgreSQL on Railway
  console.log('🐘 Connecting to PostgreSQL...');
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Railway requires SSL but uses self-signed certs
      }
    },
    logging: false
  });
} else {
  // Development: SQLite local file
  console.log('📁 Connecting to SQLite (local dev)...');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false
  });
}

// Define Models

// 1. Invoices (Faktury) - Pełna struktura
const Invoice = sequelize.define('Invoice', {
  // Identyfikacja
  entity: {
    type: DataTypes.STRING, // 'zloty_gron' lub 'srebrny_bucznik'
    allowNull: false,
    defaultValue: 'zloty_gron'
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },

  // Dane Kontrahenta
  contractorName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contractorNIP: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contractorAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Kwoty
  netAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  vatAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  grossAmount: { // Kwota brutto (do zapłaty)
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'PLN'
  },

  // Daty
  issueDate: { // Data wystawienia
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  saleDate: { // Data sprzedaży
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  paymentDate: { // Termin płatności
    type: DataTypes.DATEONLY,
    allowNull: true
  },

  // Płatność
  accountNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paymentMethod: {
    type: DataTypes.STRING, // przelew, gotówka, karta
    allowNull: true
  },

  // Statusy
  status: {
    type: DataTypes.ENUM('unpaid', 'paid', 'partial'),
    defaultValue: 'unpaid'
  },

  // Plik
  filePath: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Nowe pola (v2)
  category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  raw_ai_data: {
    type: DataTypes.JSON,
    allowNull: true
  },

  // Źródło faktury (v3 - KSeF)
  source: {
    type: DataTypes.STRING, // 'manual', 'csv', 'ksef'
    allowNull: true,
    defaultValue: 'manual'
  },
  ksefReferenceNumber: {
    type: DataTypes.STRING, // Numer referencyjny KSeF
    allowNull: true
  }
});

// 2. Settlements (Rozliczenia)
const Settlement = sequelize.define('Settlement', {
  entity: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'zloty_gron'
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  uploadDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  totalProcessed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'processed', 'error'),
    defaultValue: 'pending'
  },
  paymentsData: {
    type: DataTypes.JSON,
    allowNull: true
  }
});

// 3. History (Historia operacji)
const History = sequelize.define('History', {
  entity: {
    type: DataTypes.STRING,
    allowNull: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

// Sync database
const initDb = async () => {
  try {
    // Test connection first
    await sequelize.authenticate();
    const dbType = process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite';
    console.log(`✅ Connected to ${dbType} successfully!`);

    // alter: true pozwala na aktualizację tabel bez utraty danych (dodanie nowych kolumn)
    await sequelize.sync({ alter: true });
    console.log('✅ Database synced successfully (Schema updated).');
  } catch (error) {
    console.error('❌ Unable to connect/sync database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  Invoice,
  Settlement,
  History,
  initDb
};
