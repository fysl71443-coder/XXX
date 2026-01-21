/**
 * Fiscal Year Management Page
 * شاشة إدارة السنوات المالية
 */

import { useState, useEffect } from 'react';
import { useFiscalYear } from '../context/FiscalYearContext';
import { FiscalYearCard } from '../components/FiscalYearBanner';
import { NotificationsBanner } from '../components/FiscalYearNotifications';
import { YearComparisonReport } from '../components/FiscalYearComparison';
import { RolloverModal } from '../components/FiscalYearRollover';
import { useLang } from '../hooks/useLang';
import { useAuth } from '../context/AuthContext';
import { 
  FaCalendarAlt, FaLock, FaLockOpen, FaSync, FaHistory, 
  FaChartBar, FaPlus, FaHome, FaCog, FaExchangeAlt, FaFileAlt
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function FiscalYearManagement() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const { user } = useAuth();
  const isAr = lang === 'ar';
  
  const { 
    currentYear, 
    allYears, 
    loading, 
    getActivities, 
    getStats,
    refresh 
  } = useFiscalYear();

  const [selectedYear, setSelectedYear] = useState(null);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [showComparisonReport, setShowComparisonReport] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);

  // Load activities and stats when year is selected
  useEffect(() => {
    if (selectedYear) {
      getActivities(selectedYear.id).then(setActivities);
      getStats(selectedYear.id).then(setStats);
    }
  }, [selectedYear, getActivities, getStats]);

  // Set initial selected year
  useEffect(() => {
    if (currentYear && !selectedYear) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, selectedYear]);

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US');
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString(isAr ? 'ar-SA' : 'en-US');
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US').format(num || 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-200 rounded"
          >
            <FaHome className="text-xl" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FaCalendarAlt className="text-primary-600" />
              {isAr ? 'إدارة السنوات المالية' : 'Fiscal Year Management'}
            </h1>
            <p className="text-gray-600">
              {isAr ? 'إدارة وتتبع السنوات المالية' : 'Manage and track fiscal years'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowComparisonReport(!showComparisonReport)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <FaChartBar />
            {isAr ? 'مقارنة' : 'Compare'}
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            disabled={loading}
          >
            <FaSync className={loading ? 'animate-spin' : ''} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            <FaPlus />
            {isAr ? 'سنة جديدة' : 'New Year'}
          </button>
        </div>
      </div>

      {/* Notifications Banner */}
      <NotificationsBanner className="mb-6" />

      {/* Comparison Report */}
      {showComparisonReport && (
        <YearComparisonReport className="mb-6" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Years List */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FaCalendarAlt />
            {isAr ? 'السنوات المالية' : 'Fiscal Years'}
          </h2>
          
          <div className="space-y-2">
            {allYears.map(year => (
              <button
                key={year.id}
                onClick={() => setSelectedYear(year)}
                className={`w-full text-start p-3 rounded-lg border transition-colors ${
                  selectedYear?.id === year.id 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">{year.year}</span>
                  <span className="text-2xl">{year.statusInfo?.icon}</span>
                </div>
                <div className="text-sm text-gray-600">
                  {isAr ? year.statusInfo?.label : year.statusInfo?.labelEn}
                </div>
                {year.temporary_open && (
                  <div className="text-xs text-yellow-600 mt-1">
                    {isAr ? 'مفتوحة مؤقتاً' : 'Temporarily open'}
                  </div>
                )}
              </button>
            ))}
            
            {allYears.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                {isAr ? 'لا توجد سنوات مالية' : 'No fiscal years found'}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {selectedYear ? (
            <>
              {/* Year Card */}
              <FiscalYearCard />

              {/* Rollover Button */}
              {selectedYear?.status === 'open' && (
                <button
                  onClick={() => setShowRolloverModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <FaExchangeAlt />
                  {isAr ? `ترحيل إلى السنة ${selectedYear.year + 1}` : `Rollover to Year ${selectedYear.year + 1}`}
                </button>
              )}

              {/* Tabs */}
              <div className="bg-white rounded-lg shadow">
                <div className="border-b">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`px-6 py-3 font-medium ${
                        activeTab === 'overview' 
                          ? 'border-b-2 border-primary-600 text-primary-600' 
                          : 'text-gray-600'
                      }`}
                    >
                      <FaChartBar className="inline mr-2" />
                      {isAr ? 'نظرة عامة' : 'Overview'}
                    </button>
                    <button
                      onClick={() => setActiveTab('activities')}
                      className={`px-6 py-3 font-medium ${
                        activeTab === 'activities' 
                          ? 'border-b-2 border-primary-600 text-primary-600' 
                          : 'text-gray-600'
                      }`}
                    >
                      <FaHistory className="inline mr-2" />
                      {isAr ? 'سجل الأنشطة' : 'Activity Log'}
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === 'overview' && stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Journal Entries */}
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-blue-600 text-sm font-medium mb-1">
                          {isAr ? 'القيود اليومية' : 'Journal Entries'}
                        </div>
                        <div className="text-2xl font-bold text-blue-800">
                          {formatNumber(stats.stats?.journalEntries?.count)}
                        </div>
                        <div className="text-sm text-blue-600">
                          {isAr ? 'إجمالي المدين:' : 'Total Debit:'} {formatCurrency(stats.stats?.journalEntries?.totalDebit)}
                        </div>
                      </div>

                      {/* Invoices */}
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-green-600 text-sm font-medium mb-1">
                          {isAr ? 'الفواتير' : 'Invoices'}
                        </div>
                        <div className="text-2xl font-bold text-green-800">
                          {formatNumber(stats.stats?.invoices?.count)}
                        </div>
                        <div className="text-sm text-green-600">
                          {isAr ? 'الإجمالي:' : 'Total:'} {formatCurrency(stats.stats?.invoices?.totalAmount)}
                        </div>
                      </div>

                      {/* Expenses */}
                      <div className="bg-red-50 rounded-lg p-4">
                        <div className="text-red-600 text-sm font-medium mb-1">
                          {isAr ? 'المصروفات' : 'Expenses'}
                        </div>
                        <div className="text-2xl font-bold text-red-800">
                          {formatNumber(stats.stats?.expenses?.count)}
                        </div>
                        <div className="text-sm text-red-600">
                          {isAr ? 'الإجمالي:' : 'Total:'} {formatCurrency(stats.stats?.expenses?.totalAmount)}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'activities' && (
                    <div className="space-y-3">
                      {activities.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          {isAr ? 'لا توجد أنشطة مسجلة' : 'No activities recorded'}
                        </div>
                      ) : (
                        activities.map(activity => (
                          <div 
                            key={activity.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className={`p-2 rounded-full ${
                              activity.action === 'open' ? 'bg-green-100 text-green-600' :
                              activity.action === 'close' ? 'bg-red-100 text-red-600' :
                              activity.action === 'temporary_open' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {activity.action === 'open' ? <FaLockOpen /> :
                               activity.action === 'close' ? <FaLock /> :
                               activity.action === 'temporary_open' ? <FaSync /> :
                               <FaHistory />}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{activity.description}</div>
                              <div className="text-sm text-gray-500">
                                {activity.user_email && (
                                  <span>{isAr ? 'بواسطة:' : 'By:'} {activity.user_email} • </span>
                                )}
                                {formatDateTime(activity.created_at)}
                              </div>
                              {activity.details && Object.keys(activity.details).length > 0 && (
                                <div className="text-sm text-gray-600 mt-1">
                                  {JSON.stringify(activity.details)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              {isAr ? 'اختر سنة مالية من القائمة' : 'Select a fiscal year from the list'}
            </div>
          )}
        </div>
      </div>

      {/* Create Year Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">
              {isAr ? 'إنشاء سنة مالية جديدة' : 'Create New Fiscal Year'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                {isAr ? 'السنة:' : 'Year:'}
              </label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(parseInt(e.target.value, 10))}
                className="w-full border rounded p-2"
                min={2020}
                max={2100}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={async () => {
                  // Create year via API
                  const token = localStorage.getItem('token');
                  const res = await fetch('/api/fiscal-years', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ year: newYear })
                  });
                  if (res.ok) {
                    refresh();
                    setShowCreateModal(false);
                  }
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                {isAr ? 'إنشاء' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollover Modal */}
      {showRolloverModal && selectedYear && (
        <RolloverModal
          fiscalYear={selectedYear}
          onClose={() => setShowRolloverModal(false)}
          onSuccess={() => {
            refresh();
            setShowRolloverModal(false);
          }}
        />
      )}
    </div>
  );
}
