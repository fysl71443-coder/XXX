/**
 * Custom hook for managing POS payment state and operations
 * Handles payment methods, payment lines, and payment calculations
 */

import { useState, useCallback, useEffect } from 'react';

export function usePayments() {
  const [paymentMethod, setPaymentMethod] = useState('');
  const [payLines, setPayLines] = useState([]);
  const [payLinesInitiated, setPayLinesInitiated] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [modalPay, setModalPay] = useState([]);
  const [cashPaid, setCashPaid] = useState('');

  // Add payment line
  const addPaymentLine = useCallback((method, amount) => {
    setPayLines(prev => [...prev, { method: String(method || ''), amount: String(amount || '') }]);
    setPayLinesInitiated(true);
  }, []);

  // Update payment line
  const updatePaymentLine = useCallback((idx, patch) => {
    setPayLines(prev => prev.map((line, i) => 
      i === idx ? { ...line, ...(typeof patch === 'function' ? patch(line) : patch) } : line
    ));
  }, []);

  // Remove payment line
  const removePaymentLine = useCallback((idx) => {
    setPayLines(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Clear payments
  const clearPayments = useCallback(() => {
    setPayLines([]);
    setPayLinesInitiated(false);
    setMultiOpen(false);
    setModalPay([]);
    setCashPaid('');
  }, []);

  // Calculate payment total
  const calculatePaymentTotal = useCallback(() => {
    return payLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  }, [payLines]);

  return {
    // State
    paymentMethod,
    payLines,
    payLinesInitiated,
    multiOpen,
    modalPay,
    cashPaid,
    
    // Setters
    setPaymentMethod,
    setPayLines,
    setPayLinesInitiated,
    setMultiOpen,
    setModalPay,
    setCashPaid,
    
    // Actions
    addPaymentLine,
    updatePaymentLine,
    removePaymentLine,
    clearPayments,
    calculatePaymentTotal
  };
}
