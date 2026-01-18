// Export all models from a single file
import Account from './Account.js';
import JournalEntry from './JournalEntry.js';
import JournalPosting from './JournalPosting.js';
import Expense from './Expense.js';
import Invoice from './Invoice.js';

// Import sequelize to set up relationships
import sequelize from '../db-sequelize.js';

// Define all relationships here to avoid circular dependencies

// JournalEntry relationships
JournalEntry.hasMany(JournalPosting, {
  foreignKey: 'journal_entry_id',
  as: 'postings',
  onDelete: 'CASCADE'
});

// JournalPosting relationships
JournalPosting.belongsTo(JournalEntry, {
  foreignKey: 'journal_entry_id',
  as: 'journal'
});

JournalPosting.belongsTo(Account, {
  foreignKey: 'account_id',
  as: 'account'
});

// Expense relationships
Expense.belongsTo(JournalEntry, {
  foreignKey: 'journal_entry_id',
  as: 'journalEntry',
  onDelete: 'SET NULL'
});

// Invoice relationships
Invoice.belongsTo(JournalEntry, {
  foreignKey: 'journal_entry_id',
  as: 'journalEntry',
  onDelete: 'SET NULL'
});

// Account self-referential relationship
Account.hasMany(Account, {
  foreignKey: 'parent_id',
  as: 'children'
});

Account.belongsTo(Account, {
  foreignKey: 'parent_id',
  as: 'parent'
});

export {
  Account,
  JournalEntry,
  JournalPosting,
  Expense,
  Invoice,
  sequelize
};
