/**
 * React Query Hooks for Data Fetching
 * Provides cached, optimized data fetching with automatic refetch
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  accounts as apiAccounts,
  partners as apiPartners, 
  products as apiProducts,
  branches as apiBranches,
  settings as apiSettings,
  journal as apiJournal,
  invoices as apiInvoices,
  expenses as apiExpenses
} from '../services/api';

// ============================================
// ACCOUNTS
// ============================================

/**
 * Fetch accounts tree with caching
 */
export function useAccounts() {
  return useQuery({
    queryKey: ['accounts', 'tree'],
    queryFn: () => apiAccounts.tree(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch single account
 */
export function useAccount(id) {
  return useQuery({
    queryKey: ['accounts', id],
    queryFn: () => apiAccounts.get(id),
    enabled: !!id,
  });
}

// ============================================
// PARTNERS (CUSTOMERS/SUPPLIERS)
// ============================================

/**
 * Fetch partners list with optional filters
 */
export function usePartners(filters = {}) {
  return useQuery({
    queryKey: ['partners', filters],
    queryFn: () => apiPartners.list(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch customers only
 */
export function useCustomers() {
  return useQuery({
    queryKey: ['partners', 'customers'],
    queryFn: () => apiPartners.list({ type: 'عميل' }),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch suppliers only
 */
export function useSuppliers() {
  return useQuery({
    queryKey: ['partners', 'suppliers'],
    queryFn: () => apiPartners.list({ type: 'مورد' }),
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================
// PRODUCTS
// ============================================

/**
 * Fetch products with optional filters
 */
export function useProducts(filters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => apiProducts.list(filters),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch single product
 */
export function useProduct(id) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => apiProducts.get(id),
    enabled: !!id,
  });
}

// ============================================
// BRANCHES
// ============================================

/**
 * Fetch all branches
 */
export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => apiBranches.list(),
    staleTime: 10 * 60 * 1000, // 10 minutes - branches rarely change
  });
}

// ============================================
// SETTINGS
// ============================================

/**
 * Fetch settings by key
 */
export function useSettings(key) {
  return useQuery({
    queryKey: ['settings', key],
    queryFn: () => apiSettings.get(key),
    staleTime: 5 * 60 * 1000,
    enabled: !!key,
  });
}

/**
 * Fetch company settings
 */
export function useCompanySettings() {
  return useSettings('settings_company');
}

/**
 * Fetch branding settings
 */
export function useBrandingSettings() {
  return useSettings('settings_branding');
}

// ============================================
// JOURNAL ENTRIES
// ============================================

/**
 * Fetch journal entries with filters
 */
export function useJournalEntries(filters = {}) {
  return useQuery({
    queryKey: ['journal', filters],
    queryFn: () => apiJournal.list(filters),
    staleTime: 1 * 60 * 1000, // 1 minute - journal entries change often
  });
}

/**
 * Fetch single journal entry
 */
export function useJournalEntry(id) {
  return useQuery({
    queryKey: ['journal', id],
    queryFn: () => apiJournal.get(id),
    enabled: !!id,
  });
}

// ============================================
// INVOICES
// ============================================

/**
 * Fetch invoices with filters
 */
export function useInvoices(filters = {}) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => apiInvoices.list(filters),
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Fetch single invoice
 */
export function useInvoice(id) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => apiInvoices.get(id),
    enabled: !!id,
  });
}

// ============================================
// EXPENSES
// ============================================

/**
 * Fetch expenses with filters
 */
export function useExpenses(filters = {}) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => apiExpenses.list(filters),
    staleTime: 1 * 60 * 1000,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Create partner mutation
 */
export function useCreatePartner() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => apiPartners.create(data),
    onSuccess: () => {
      // Invalidate partners cache
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
  });
}

/**
 * Update partner mutation
 */
export function useUpdatePartner() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => apiPartners.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
  });
}

/**
 * Create product mutation
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => apiProducts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

/**
 * Create journal entry mutation
 */
export function useCreateJournalEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => apiJournal.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] }); // Balances may change
    },
  });
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Prefetch data for navigation
 */
export function usePrefetch() {
  const queryClient = useQueryClient();
  
  return {
    prefetchAccounts: () => {
      queryClient.prefetchQuery({
        queryKey: ['accounts', 'tree'],
        queryFn: () => apiAccounts.tree(),
      });
    },
    prefetchProducts: () => {
      queryClient.prefetchQuery({
        queryKey: ['products', {}],
        queryFn: () => apiProducts.list(),
      });
    },
    prefetchPartners: () => {
      queryClient.prefetchQuery({
        queryKey: ['partners', {}],
        queryFn: () => apiPartners.list(),
      });
    },
  };
}

/**
 * Invalidate all caches (useful after major updates)
 */
export function useInvalidateAll() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries();
  };
}
