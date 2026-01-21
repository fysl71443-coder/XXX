/**
 * Fiscal Year Context
 * سياق السنة المالية - متاح في كل مكان بالتطبيق
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const FiscalYearContext = createContext(null);

// API base URL
const API_BASE = '/api/fiscal-years';

export function FiscalYearProvider({ children }) {
  const { isLoggedIn, token } = useAuth();
  
  const [currentYear, setCurrentYear] = useState(null);
  const [allYears, setAllYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Headers for API calls
  const getHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
  }), [token]);

  // Fetch current fiscal year
  const fetchCurrentYear = useCallback(async () => {
    if (!isLoggedIn) return;
    
    try {
      const res = await fetch(`${API_BASE}/current`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCurrentYear(data);
        setError(null);
      } else {
        console.warn('[FiscalYear] Could not fetch current year');
      }
    } catch (e) {
      console.error('[FiscalYear] Error fetching current year:', e);
      setError(e.message);
    }
  }, [isLoggedIn, getHeaders]);

  // Fetch all fiscal years
  const fetchAllYears = useCallback(async () => {
    if (!isLoggedIn) return;
    
    try {
      const res = await fetch(API_BASE, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAllYears(data);
      }
    } catch (e) {
      console.error('[FiscalYear] Error fetching all years:', e);
    }
  }, [isLoggedIn, getHeaders]);

  // Initial load
  useEffect(() => {
    if (isLoggedIn) {
      setLoading(true);
      Promise.all([fetchCurrentYear(), fetchAllYears()])
        .finally(() => setLoading(false));
    } else {
      setCurrentYear(null);
      setAllYears([]);
      setLoading(false);
    }
  }, [isLoggedIn, fetchCurrentYear, fetchAllYears]);

  // Check if entries can be created for a specific date
  const canCreateForDate = useCallback(async (date) => {
    try {
      const res = await fetch(`${API_BASE}/can-create?date=${date}`, { headers: getHeaders() });
      if (res.ok) {
        return await res.json();
      }
      return { canCreate: false, reason: 'خطأ في التحقق' };
    } catch (e) {
      return { canCreate: false, reason: e.message };
    }
  }, [getHeaders]);

  // Get fiscal year for a date
  const getYearForDate = useCallback(async (date) => {
    try {
      const res = await fetch(`${API_BASE}/for-date?date=${date}`, { headers: getHeaders() });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      return null;
    }
  }, [getHeaders]);

  // Open a fiscal year
  const openYear = useCallback(async (yearId) => {
    try {
      const res = await fetch(`${API_BASE}/${yearId}/open`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        await fetchCurrentYear();
        await fetchAllYears();
        return { success: true };
      }
      const error = await res.json();
      return { success: false, error: error.message };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [getHeaders, fetchCurrentYear, fetchAllYears]);

  // Close a fiscal year
  const closeYear = useCallback(async (yearId, notes) => {
    try {
      const res = await fetch(`${API_BASE}/${yearId}/close`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ notes })
      });
      if (res.ok) {
        await fetchCurrentYear();
        await fetchAllYears();
        return { success: true };
      }
      const error = await res.json();
      return { success: false, error: error.message };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [getHeaders, fetchCurrentYear, fetchAllYears]);

  // Temporary open
  const temporaryOpen = useCallback(async (yearId, reason) => {
    try {
      const res = await fetch(`${API_BASE}/${yearId}/temporary-open`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        await fetchCurrentYear();
        await fetchAllYears();
        return { success: true };
      }
      const error = await res.json();
      return { success: false, error: error.message };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [getHeaders, fetchCurrentYear, fetchAllYears]);

  // Temporary close
  const temporaryClose = useCallback(async (yearId) => {
    try {
      const res = await fetch(`${API_BASE}/${yearId}/temporary-close`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        await fetchCurrentYear();
        await fetchAllYears();
        return { success: true };
      }
      const error = await res.json();
      return { success: false, error: error.message };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [getHeaders, fetchCurrentYear, fetchAllYears]);

  // Get activities for a year
  const getActivities = useCallback(async (yearId) => {
    try {
      const res = await fetch(`${API_BASE}/${yearId}/activities`, { headers: getHeaders() });
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch (e) {
      return [];
    }
  }, [getHeaders]);

  // Get statistics for a year
  const getStats = useCallback(async (yearId) => {
    try {
      const res = await fetch(`${API_BASE}/${yearId}/stats`, { headers: getHeaders() });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      return null;
    }
  }, [getHeaders]);

  // Refresh data
  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCurrentYear(), fetchAllYears()]);
    setLoading(false);
  }, [fetchCurrentYear, fetchAllYears]);

  // Get notifications
  const getNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications`, { headers: getHeaders() });
      if (res.ok) {
        return await res.json();
      }
      return { notifications: [], count: 0 };
    } catch (e) {
      return { notifications: [], count: 0 };
    }
  }, [getHeaders]);

  // Get checklist for year-end
  const getChecklist = useCallback(async (yearId) => {
    try {
      const res = await fetch(`${API_BASE}/${yearId}/checklist`, { headers: getHeaders() });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      return null;
    }
  }, [getHeaders]);

  // Compare years
  const compareYears = useCallback(async (year1, year2) => {
    try {
      const res = await fetch(`${API_BASE}/compare?year1=${year1}&year2=${year2}`, { headers: getHeaders() });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      return null;
    }
  }, [getHeaders]);

  // Rollover fiscal year
  const rolloverYear = useCallback(async (yearId, targetYear) => {
    try {
      const res = await fetch(`${API_BASE}/${yearId}/rollover`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ target_year: targetYear })
      });
      if (res.ok) {
        await fetchCurrentYear();
        await fetchAllYears();
        return { success: true, data: await res.json() };
      }
      const error = await res.json();
      return { success: false, error: error.message };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [getHeaders, fetchCurrentYear, fetchAllYears]);

  // Computed values
  const canCreateEntries = currentYear?.canCreateEntries ?? false;
  const isClosed = currentYear?.status === 'closed' && !currentYear?.temporary_open;
  const isTemporaryOpen = currentYear?.status === 'closed' && currentYear?.temporary_open;

  const value = {
    // State
    currentYear,
    allYears,
    loading,
    error,
    
    // Computed
    canCreateEntries,
    isClosed,
    isTemporaryOpen,
    
    // Actions
    canCreateForDate,
    getYearForDate,
    openYear,
    closeYear,
    temporaryOpen,
    temporaryClose,
    getActivities,
    getStats,
    refresh,
    getNotifications,
    getChecklist,
    compareYears,
    rolloverYear
  };

  return (
    <FiscalYearContext.Provider value={value}>
      {children}
    </FiscalYearContext.Provider>
  );
}

// Hook for using fiscal year context
export function useFiscalYear() {
  const context = useContext(FiscalYearContext);
  if (!context) {
    throw new Error('useFiscalYear must be used within a FiscalYearProvider');
  }
  return context;
}

// HOC for checking fiscal year status before actions
export function withFiscalYearCheck(WrappedComponent) {
  return function FiscalYearCheckedComponent(props) {
    const { canCreateEntries, currentYear } = useFiscalYear();
    
    return (
      <WrappedComponent
        {...props}
        canCreateEntries={canCreateEntries}
        fiscalYear={currentYear}
      />
    );
  };
}

export default FiscalYearContext;
