import { DataTypes } from 'sequelize';
import sequelize from '../db-sequelize.js';

const JournalEntry = sequelize.define('JournalEntry', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  entry_number: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  period: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reference_type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  reference_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'draft'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'journal_entries',
  timestamps: false,
  underscored: true
});

// Relationships will be defined in models/index.js to avoid circular dependencies

export default JournalEntry;
