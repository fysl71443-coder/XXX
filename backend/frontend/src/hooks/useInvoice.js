/**
 * Custom hook for managing POS invoice state and operations
 * Handles invoice creation, issuing, and number generation
 */

import { useState, useCallback, useEffect } from 'react';
import { invoices as apiInvoices, pos } from '../services/api';

export function useInvoice(branch, table, orderId) {
  const [invoiceNumber, setInvoiceNumber] = useState('Auto');
  const [invoiceReady, setInvoiceReady] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Issue invoice
  const issueInvoice = useCallback(async (paymentType, orderIdForIssue, payload) => {
    setLoadingInvoice(true);
    try {
      const res = await pos.issueInvoice(payload);
      return res;
    } catch (err) {
      console.error('[useInvoice] Error issuing invoice:', err);
      throw err;
    } finally {
      setLoadingInvoice(false);
    }
  }, []);

  // Get next invoice number
  const getNextInvoiceNumber = useCallback(async () => {
    try {
      const n = await apiInvoices.nextNumber();
      if (n && n.next) {
        setInvoiceNumber(n.next);
        return n.next;
      }
    } catch (e) {
      console.error('[useInvoice] Error getting next invoice number:', e);
    }
    return null;
  }, []);

  // Reset invoice state
  const resetInvoice = useCallback(() => {
    setInvoiceNumber('Auto');
    setInvoiceReady(false);
  }, []);

  return {
    invoiceNumber,
    invoiceReady,
    loadingInvoice,
    setInvoiceNumber,
    setInvoiceReady,
    issueInvoice,
    getNextInvoiceNumber,
    resetInvoice
  };
}
