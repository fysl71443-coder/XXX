import { useState, useEffect, useCallback, useMemo } from 'react';
import { employees as apiEmployees, payroll as apiPayroll, settings as apiSettings } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook for managing employees data, filters, and related state
 * Separates data fetching logic from UI components
 */
export function useEmployeesData() {
  const { loading: authLoading, isLoggedIn } = useAuth();
  const [list, setList] = useState([]);
  const [filters, setFilters] = useState({
    saudization: '',
    active: '',
    gosi: '',
    include_disabled: ''
  });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState([]);
  const [prevDues, setPrevDues] = useState([]);
  const [company, setCompany] = useState(null);
  const [branding, setBranding] = useState(null);
  const [footerCfg, setFooterCfg] = useState(null);

  // Load employees list - only fetch once on mount, filtering is done client-side
  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await apiEmployees.list();
      if (!rows) {
        console.warn('[useEmployeesData] No data returned from API');
        setList([]);
        return;
      }
      setList(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error('[useEmployeesData] Error loading employees:', e);
      if (e?.status === 403) {
        setError('ليس لديك صلاحية لعرض هذه الشاشة');
      } else {
        setError('تعذر تحميل البيانات');
      }
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies - fetch once on mount

  // Load payroll runs
  const loadRuns = useCallback(async () => {
    try {
      const rs = await apiPayroll.runs();
      setRuns(Array.isArray(rs) ? rs : []);
    } catch (e) {
      console.error('Failed to load payroll runs:', e);
      setRuns([]);
    }
  }, []);

  // Load previous dues
  const loadPrevDues = useCallback(async () => {
    try {
      const dues = await apiPayroll.previousDues();
      setPrevDues(Array.isArray(dues) ? dues : []);
    } catch (e) {
      console.error('Failed to load previous dues:', e);
      setPrevDues([]);
    }
  }, []);

  // Load settings (company, branding, footer)
  const loadSettings = useCallback(async () => {
    try {
      const [c, b, f] = await Promise.all([
        apiSettings.get('settings_branding/settings_company').catch(() => null),
        apiSettings.get('settings_branding').catch(() => null),
        apiSettings.get('settings_branding/settings_footer').catch(() => null)
      ]);
      setCompany(c);
      setBranding(b);
      setFooterCfg(f);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }, []);

  // Main load function - loads all data
  const load = useCallback(async () => {
    await Promise.all([
      loadEmployees(),
      loadRuns(),
      loadPrevDues(),
      loadSettings()
    ]);
  }, [loadEmployees, loadRuns, loadPrevDues, loadSettings]);

  // Initial load on mount - CRITICAL: Wait for auth to be ready
  useEffect(() => {
    if (authLoading || !isLoggedIn) {
      console.log('[useEmployeesData] Waiting for auth before loading data...');
      return;
    }
    load();
  }, [load, authLoading, isLoggedIn]);

  // Listen for storage events (e.g., when prev_dues_version changes)
  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'prev_dues_version') {
        loadPrevDues();
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadPrevDues]);

  // Filtered employees list (client-side filtering)
  const filtered = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return list.filter(e => {
      if (String(e.status || '') === 'disabled' && String(filters.include_disabled || '') !== '1') {
        return false;
      }
      if (String(filters.saudization || '') === 'saudi' && String(e.nationality || '').toUpperCase() !== 'SA') {
        return false;
      }
      if (String(filters.saudization || '') === 'non_saudi' && String(e.nationality || '').toUpperCase() === 'SA') {
        return false;
      }
      if (String(filters.active || '') === 'true' && String(e.status || '') !== 'active') {
        return false;
      }
      if (String(filters.active || '') === 'false' && String(e.status || '') !== 'terminated') {
        return false;
      }
      if (String(filters.gosi || '') === 'true' && !e.gosi_enrolled) {
        return false;
      }
      if (String(filters.gosi || '') === 'false' && !!e.gosi_enrolled) {
        return false;
      }
      if (q && !(`${e.employee_number || ''} ${e.full_name || ''}`.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [list, search, filters]);

  // Calculate gross salary for an employee
  const gross = useCallback((e) => {
    const b = Number(e.basic_salary || 0);
    const h = Number(e.housing_allowance || 0);
    const t = Number(e.transport_allowance || 0);
    const o = Number(e.other_allowances || 0);
    return b + h + t + o;
  }, []);

  // Previous dues by employee ID
  const prevByEmp = useMemo(() => {
    const m = new Map();
    (prevDues || []).forEach(d => {
      const id = Number(d.employee_id || 0);
      const amt = parseFloat(d.amount || 0);
      if (!id) return;
      m.set(id, (m.get(id) || 0) + (isFinite(amt) ? amt : 0));
    });
    return m;
  }, [prevDues]);

  // Statistics
  const stats = useMemo(() => {
    const total = list.length;
    const active = list.filter(e => String(e.status || '') === 'active').length;
    const terminated = list.filter(e => String(e.status || '') === 'terminated').length;
    const saudi = list.filter(e => String(e.nationality || '').toUpperCase() === 'SA').length;
    const grossTotal = list.reduce((sum, e) => sum + gross(e), 0);
    return { total, active, terminated, saudi, nonSaudi: total - saudi, grossTotal };
  }, [list, gross]);

  return {
    // Data
    list,
    filtered,
    runs,
    prevDues,
    prevByEmp,
    company,
    branding,
    footerCfg,
    
    // State
    filters,
    search,
    error,
    loading,
    stats,
    
    // Setters
    setFilters,
    setSearch,
    setError,
    
    // Functions
    load,
    loadEmployees,
    loadRuns,
    loadPrevDues,
    gross,
  };
}
