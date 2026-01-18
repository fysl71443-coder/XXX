import { DataTypes } from 'sequelize';
import sequelize from '../db-sequelize.js';

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  number: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  lines: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  subtotal: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    defaultValue: 0
  },
  discount_pct: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  discount_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    defaultValue: 0
  },
  tax_pct: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  tax_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    defaultValue: 0
  },
  total: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    defaultValue: 0
  },
  payment_method: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'draft'
  },
  branch: {
    type: DataTypes.STRING,
    allowNull: true
  },
  journal_entry_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'journal_entries',
      key: 'id'
    }
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'invoices',
  timestamps: false,
  underscored: true
});

// Relationships will be defined in models/index.js to avoid circular dependencies

export default Invoice;
