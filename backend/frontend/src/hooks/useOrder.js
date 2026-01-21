/**
 * Custom hook for managing POS order state and operations
 * Handles order creation, loading, saving, and hydration
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { orders as apiOrders, pos } from '../services/api';

export function useOrder() {
  const navigate = useNavigate();
  const { branch, table } = useParams();
  const [qs] = useSearchParams();
  const orderId = qs.get('order');

  // Refs for preventing duplicate calls
  const hasLoadedOrderRef = useRef(false);
  const creatingOrderRef = useRef(false);
  const savingRef = useRef(false);
  const saveDraftInFlightRef = useRef(false);
  const saveTimerRef = useRef(null);
  const initialDraftSavedRef = useRef(false);
  const isHydratingRef = useRef(false);
  const firstItemSavedRef = useRef(false);
  const lastSavedHashRef = useRef(null);
  const hydratedFromOrderRef = useRef(false);
  const hydratedOrderIdRef = useRef(null);
  const itemsRef = useRef([]);
  const pendingChangesRef = useRef(false);
  const savePendingRef = useRef(false);
  const pendingHashRef = useRef(null);
  const saveQueuePendingRef = useRef(false);
  const saveQueueTimerRef = useRef(null);
  const orderLoadInProgressRef = useRef(false);
  const lastLoadedOrderKeyRef = useRef(null);
  const orderHydrationInProgressRef = useRef(false);
  const tableHydrationInProgressRef = useRef(false);
  const lastHydratedTableKeyRef = useRef(null);

  // State
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [tableBusy, setTableBusy] = useState(false);
  const [items, setItems] = useState([]);

  // Helper: Normalize branch name
  const normalizeBranch = useCallback((b) => {
    const s = String(b || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (s === 'palace_india' || s === 'palce_india') return 'place_india';
    return s;
  }, []);

  // Helper: Get stored order ID from localStorage
  const getStoredOrderId = useCallback(() => {
    try {
      const k1 = `pos_order_${branch}_${table}`;
      const k2 = `pos_order_${normalizeBranch(branch)}_${table}`;
      return orderId || localStorage.getItem(k1) || localStorage.getItem(k2) || '';
    } catch {
      return orderId || '';
    }
  }, [branch, table, orderId, normalizeBranch]);

  // Load order from API
  const hydrateOrder = useCallback(async (effectiveId) => {
    if (!effectiveId) return;
    if (isHydratingRef.current && hydratedOrderIdRef.current === String(effectiveId)) return;
    
    isHydratingRef.current = true;
    hydratedOrderIdRef.current = String(effectiveId);
    
    // Try cache first
    const cacheKey = `pos_order_cache_${effectiveId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        if (cachedData && Array.isArray(cachedData.items) && cachedData.items.length > 0) {
          itemsRef.current = cachedData.items;
          setItems(cachedData.items);
          // Don't set loading states - data is already displayed
        }
      }
    } catch {}
    
    setHydrating(true);
    setLoadingOrder(true);
    
    try {
      const o = await apiOrders.get(effectiveId);
      if (!o) {
        throw new Error('Order not found');
      }
      
      const arr = Array.isArray(o.lines) ? o.lines : [];
      const meta = arr.find(x => x && x.type === 'meta') || {};
      const orderItems = arr.filter(x => x && x.type === 'item').map(l => ({
        product_id: l.product_id,
        name: l.name || '',
        name_en: l.name_en || '',
        qty: Number(l.qty || 0),
        price: Number(l.price || 0),
        discount: Number(l.discount || 0)
      }));
      
      const safeOrderItems = Array.isArray(orderItems) ? orderItems : [];
      itemsRef.current = safeOrderItems;
      setItems(safeOrderItems);
      
      // Cache order data
      try {
        const cacheData = {
          items: safeOrderItems,
          meta: meta,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch {}
      
      const bnorm = normalizeBranch(branch);
      try {
        localStorage.setItem(`pos_order_${branch}_${table}`, String(effectiveId));
        localStorage.setItem(`pos_order_${bnorm}_${table}`, String(effectiveId));
        localStorage.setItem('current_branch', bnorm);
      } catch {}
      
    } catch (e) {
      console.error('[useOrder] Error hydrating order:', e);
      throw e;
    } finally {
      isHydratingRef.current = false;
      setHydrating(false);
      setLoadingOrder(false);
    }
  }, [branch, table, normalizeBranch]);

  // Save draft order
  const saveDraft = useCallback(async (payload) => {
    if (isHydratingRef.current) {
      savingRef.current = false;
      return 0;
    }
    
    if (savingRef.current) return;
    savingRef.current = true;
    
    try {
      const resp = await pos.saveDraft(payload);
      const id = resp?.order_id ? String(resp.order_id) : '';
      
      if (id) {
        const norm = normalizeBranch(branch);
        try {
          localStorage.setItem(`pos_order_${branch}_${table}`, String(id));
          localStorage.setItem(`pos_order_${norm}_${table}`, String(id));
          if (!orderId && id) {
            navigate(`/pos/${branch}/tables/${table}?order=${id}`, { replace: true });
          }
        } catch {}
      }
      
      return id;
    } catch (e) {
      console.error('[useOrder] Error saving draft:', e);
      throw e;
    } finally {
      savingRef.current = false;
    }
  }, [branch, table, orderId, navigate, normalizeBranch]);

  // Add item to order
  const addItem = useCallback((product) => {
    const base = Array.isArray(itemsRef.current) ? itemsRef.current : [];
    const idx = base.findIndex(it => 
      String(it.product_id || it.id || '') === String(product.id) || 
      String(it.name || '') === String(product.name)
    );
    
    const next = idx >= 0
      ? base.map((it, i) => i === idx ? { ...it, qty: Number(it.qty || 0) + 1 } : it)
      : [...base, {
        product_id: product.id,
        name: product.name,
        name_en: product.name_en || '',
        qty: 1,
        price: Number(product.price || 0),
        discount: 0
      }];
    
    itemsRef.current = next;
    setItems(next);
    pendingChangesRef.current = true;
  }, []);

  // Update item
  const updateItem = useCallback((idx, patch) => {
    const base = Array.isArray(itemsRef.current) ? itemsRef.current : [];
    const next = base.map((it, i) => 
      i === idx ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch) } : it
    );
    itemsRef.current = next;
    setItems(next);
    pendingChangesRef.current = true;
  }, []);

  // Remove item
  const removeItem = useCallback((idx) => {
    const base = Array.isArray(itemsRef.current) ? itemsRef.current : [];
    const next = base.filter((_, i) => i !== idx);
    itemsRef.current = next;
    setItems(next);
    pendingChangesRef.current = true;
  }, []);

  return {
    // State
    items,
    setItems, // Expose setItems for compatibility
    loadingOrder,
    setLoadingOrder, // Expose for POSInvoice custom hydrateOrder
    hydrating,
    setHydrating, // Expose for POSInvoice custom hydrateOrder
    tableBusy,
    setTableBusy, // Expose for POSInvoice custom hydrateOrder
    orderId: getStoredOrderId(),
    
    // Actions
    hydrateOrder,
    saveDraft,
    addItem,
    updateItem,
    removeItem,
    
    // Refs (exposed for compatibility during refactoring)
    itemsRef,
    hasLoadedOrderRef,
    creatingOrderRef,
    savingRef,
    saveDraftInFlightRef,
    saveTimerRef,
    initialDraftSavedRef,
    isHydratingRef,
    firstItemSavedRef,
    lastSavedHashRef,
    hydratedFromOrderRef,
    hydratedOrderIdRef,
    pendingChangesRef,
    savePendingRef,
    pendingHashRef,
    saveQueuePendingRef,
    saveQueueTimerRef,
    orderLoadInProgressRef,
    lastLoadedOrderKeyRef,
    orderHydrationInProgressRef,
    tableHydrationInProgressRef,
    lastHydratedTableKeyRef,
    
    // Helpers
    normalizeBranch,
    getStoredOrderId
  };
}
