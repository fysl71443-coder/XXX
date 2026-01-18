import { DataTypes } from 'sequelize';
import sequelize from '../db-sequelize.js';

const JournalPosting = sequelize.define('JournalPosting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  journal_entry_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'journal_entries',
      key: 'id'
    }
  },
  account_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'accounts',
      key: 'id'
    }
  },
  debit: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  credit: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'journal_postings',
  timestamps: false,
  underscored: true
});

// Relationships will be defined in models/index.js to avoid circular dependencies

export default JournalPosting;
