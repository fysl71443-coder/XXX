import { DataTypes } from 'sequelize';
import sequelize from '../db-sequelize.js';

const Expense = sequelize.define('Expense', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoice_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    defaultValue: 0
  },
  total: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
    defaultValue: 0
  },
  account_code: {
    type: DataTypes.STRING,
    allowNull: true
  },
  partner_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
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
  date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  payment_method: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'cash'
  },
  items: {
    type: DataTypes.JSONB,
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
  tableName: 'expenses',
  timestamps: false,
  underscored: true
});

// Relationships will be defined in models/index.js to avoid circular dependencies

export default Expense;
