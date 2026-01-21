import express from 'express';
import { pool } from '../db.js';
// Import routes (سيتم إضافتها تدريجياً)
import authRoutes from './auth.js';
import orderRoutes from './orders.js';
import invoiceRoutes from './invoices.js';
import posRoutes from './pos.js';
import expenseRoutes from './expenses.js';
import partnerRoutes from './partners.js';
import productRoutes from './products.js';
import accountRoutes from './accounts.js';
import userRoutes from './users.js';
import settingsRoutes from './settings.js';
import reportRoutes from './reports.js';
import journalRoutes from './journal.js';
import auditRoutes from './audit.js';
import fiscalYearRoutes from './fiscalYears.js';
import importRoutes from './import.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/pos', posRoutes);
router.use('/expenses', expenseRoutes);
router.use('/partners', partnerRoutes);
router.use('/products', productRoutes);
router.use('/accounts', accountRoutes);
router.use('/users', userRoutes);
router.use('/settings', settingsRoutes);
router.use('/reports', reportRoutes);
router.use('/audit', auditRoutes);
// Customers is an alias for partners with type=customer
router.get('/customers', authenticateToken, authorize('clients', 'view'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM partners WHERE type = $1 OR type = $2 ORDER BY id DESC', ['customer', 'عميل']);
    res.json({ items: rows || [] });
  } catch (e) {
    console.error('[CUSTOMERS] Error listing:', e);
    res.json({ items: [] });
  }
});
router.use('/journal', journalRoutes);
router.use('/fiscal-years', fiscalYearRoutes);
router.use('/import', importRoutes);

export default router;
