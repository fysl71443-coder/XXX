/**
 * Fiscal Year Comparison Component
 * مكون مقارنة السنوات المالية
 */

import { useState, useEffect } from 'react';
import { useFiscalYear } from '../context/FiscalYearContext';
import { useLang } from '../hooks/useLang';
import { 
  FaChartBar, FaArrowUp, FaArrowDown, FaMinus,
  FaExchangeAlt, FaSync
} from 'react-icons/fa';

/**
 * Year Comparison Report
 */
export function YearComparisonReport({ className = '' }) {
  const { allYears } = useFiscalYear();
  const { lang } = useLang();
  const isAr = lang === 'ar';

  const [year1, setYear1] = useState(null);
  const [year2, setYear2] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Set default years
  useEffect(() => {
    if (allYears.length >= 2) {
      setYear1(allYears[1]?.year); // Previous year
      setYear2(allYears[0]?.year); // Current year
    } else if (allYears.length === 1) {
      setYear1(allYears[0]?.year - 1);
      setYear2(allYears[0]?.year);
    }
  }, [allYears]);

  // Fetch comparison
  const fetchComparison = async () => {
    if (!year1 || !year2) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/fiscal-years/compare?year1=${year1}&year2=${year2}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setComparison(data);
      } else {
        const err = await res.json();
        setError(err.message || 'Error fetching comparison');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (year1 && year2) {
      fetchComparison();
    }
  }, [year1, year2]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatPercent = (value) => {
    const num = parseFloat(value) || 0;
    return `${num > 0 ? '+' : ''}${num.toFixed(1)}%`;
  };

  const getChangeIcon = (change) => {
    if (change > 0) return <FaArrowUp className="text-green-500" />;
    if (change < 0) return <FaArrowDown className="text-red-500" />;
    return <FaMinus className="text-gray-400" />;
  };

  const getChangeColor = (change, inverse = false) => {
    if (change === 0) return 'text-gray-500';
    if (inverse) {
      return change > 0 ? 'text-red-600' : 'text-green-600';
    }
    return change > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`} dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FaExchangeAlt className="text-primary-600" />
            {isAr ? 'مقارنة السنوات المالية' : 'Fiscal Year Comparison'}
          </h2>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">
                {isAr ? 'السنة الأولى:' : 'Year 1:'}
              </label>
              <select
                value={year1 || ''}
                onChange={(e) => setYear1(parseInt(e.target.value, 10))}
                className="border rounded p-1 text-sm"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">
                {isAr ? 'السنة الثانية:' : 'Year 2:'}
              </label>
              <select
                value={year2 || ''}
                onChange={(e) => setYear2(parseInt(e.target.value, 10))}
                className="border rounded p-1 text-sm"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchComparison}
              disabled={loading}
              className="p-2 text-primary-600 hover:bg-primary-50 rounded"
            >
              <FaSync className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">
            <FaSync className="animate-spin text-3xl text-primary-600 mx-auto mb-2" />
            <p className="text-gray-500">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <p>{error}</p>
          </div>
        ) : comparison ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Revenue */}
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 mb-1">
                  {isAr ? 'الإيرادات' : 'Revenue'}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">{year1}</div>
                    <div className="font-bold">{formatCurrency(comparison.summary?.revenue?.year1)}</div>
                  </div>
                  <div className="text-2xl">{getChangeIcon(comparison.summary?.revenue?.change)}</div>
                  <div className="text-end">
                    <div className="text-xs text-gray-500">{year2}</div>
                    <div className="font-bold">{formatCurrency(comparison.summary?.revenue?.year2)}</div>
                  </div>
                </div>
                <div className={`text-sm mt-2 text-center ${getChangeColor(comparison.summary?.revenue?.change)}`}>
                  {formatPercent(comparison.summary?.revenue?.changePercent)}
                </div>
              </div>

              {/* Expenses */}
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600 mb-1">
                  {isAr ? 'المصروفات' : 'Expenses'}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">{year1}</div>
                    <div className="font-bold">{formatCurrency(comparison.summary?.expenses?.year1)}</div>
                  </div>
                  <div className="text-2xl">{getChangeIcon(comparison.summary?.expenses?.change)}</div>
                  <div className="text-end">
                    <div className="text-xs text-gray-500">{year2}</div>
                    <div className="font-bold">{formatCurrency(comparison.summary?.expenses?.year2)}</div>
                  </div>
                </div>
                <div className={`text-sm mt-2 text-center ${getChangeColor(comparison.summary?.expenses?.change, true)}`}>
                  {formatPercent(comparison.summary?.expenses?.changePercent)}
                </div>
              </div>

              {/* Net Income */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1">
                  {isAr ? 'صافي الربح' : 'Net Income'}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">{year1}</div>
                    <div className="font-bold">{formatCurrency(comparison.summary?.netIncome?.year1)}</div>
                  </div>
                  <div className="text-2xl">{getChangeIcon(comparison.summary?.netIncome?.change)}</div>
                  <div className="text-end">
                    <div className="text-xs text-gray-500">{year2}</div>
                    <div className="font-bold">{formatCurrency(comparison.summary?.netIncome?.year2)}</div>
                  </div>
                </div>
                <div className={`text-sm mt-2 text-center ${getChangeColor(comparison.summary?.netIncome?.change)}`}>
                  {formatPercent(comparison.summary?.netIncome?.changePercent)}
                </div>
              </div>
            </div>

            {/* Account Comparison Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-start">{isAr ? 'الحساب' : 'Account'}</th>
                    <th className="p-3 text-end">{year1}</th>
                    <th className="p-3 text-end">{year2}</th>
                    <th className="p-3 text-end">{isAr ? 'التغيير' : 'Change'}</th>
                    <th className="p-3 text-end">%</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.accountComparison?.slice(0, 20).map((acc, idx) => (
                    <tr key={acc.id || idx} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium">{acc.accountNumber}</div>
                        <div className="text-xs text-gray-500">{acc.name}</div>
                      </td>
                      <td className="p-3 text-end">{formatCurrency(acc.year1Balance)}</td>
                      <td className="p-3 text-end">{formatCurrency(acc.year2Balance)}</td>
                      <td className={`p-3 text-end ${getChangeColor(acc.change)}`}>
                        {formatCurrency(acc.change)}
                      </td>
                      <td className={`p-3 text-end ${getChangeColor(acc.changePercent)}`}>
                        {formatPercent(acc.changePercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {comparison.accountComparison?.length > 20 && (
                <div className="p-3 text-center text-gray-500 border-t">
                  {isAr 
                    ? `يتم عرض أول 20 حساب من ${comparison.accountComparison.length}`
                    : `Showing first 20 of ${comparison.accountComparison.length} accounts`
                  }
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {isAr ? 'اختر السنوات للمقارنة' : 'Select years to compare'}
          </div>
        )}
      </div>
    </div>
  );
}

export default YearComparisonReport;
