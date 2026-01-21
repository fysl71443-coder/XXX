/**
 * Fiscal Year Banner Component
 * شريط حالة السنة المالية - يُعرض في الشاشات المحاسبية
 */

import { useState } from 'react';
import { useFiscalYear } from '../context/FiscalYearContext';
import { FaLock, FaLockOpen, FaSync, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import { useLang } from '../hooks/useLang';

/**
 * Compact banner for top of accounting screens
 */
export function FiscalYearBanner({ showActions = false, className = '' }) {
  const { currentYear, loading, canCreateEntries, isClosed, isTemporaryOpen } = useFiscalYear();
  const { lang } = useLang();
  const isAr = lang === 'ar';

  if (loading) {
    return (
      <div className={`bg-gray-100 rounded-lg p-3 animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-48"></div>
      </div>
    );
  }

  if (!currentYear) {
    return null;
  }

  const { statusInfo, year, temporary_open_reason } = currentYear;
  
  // Color classes based on status
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800'
  };

  const bgClass = colorClasses[statusInfo?.color] || colorClasses.gray;

  return (
    <div className={`border rounded-lg p-3 ${bgClass} ${className}`} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{statusInfo?.icon}</span>
          <div>
            <div className="font-medium">
              {isAr ? 'السنة المالية الحالية:' : 'Current Fiscal Year:'} {year}
            </div>
            <div className="text-sm opacity-80">
              {isAr ? statusInfo?.label : statusInfo?.labelEn}
              {isTemporaryOpen && temporary_open_reason && (
                <span className="mr-2 text-xs">
                  ({isAr ? 'السبب:' : 'Reason:'} {temporary_open_reason})
                </span>
              )}
            </div>
          </div>
        </div>
        
        {!canCreateEntries && (
          <div className="flex items-center gap-2 text-sm">
            <FaExclamationTriangle />
            <span>{isAr ? statusInfo?.message : statusInfo?.messageEn}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Detailed fiscal year status card
 */
export function FiscalYearCard({ onOpenYear, onCloseYear, onTemporaryOpen, onTemporaryClose }) {
  const { 
    currentYear, 
    loading, 
    canCreateEntries, 
    isClosed, 
    isTemporaryOpen,
    openYear,
    closeYear,
    temporaryOpen,
    temporaryClose
  } = useFiscalYear();
  const { lang } = useLang();
  const isAr = lang === 'ar';
  
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  if (loading || !currentYear) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  const { statusInfo, year, start_date, end_date, notes, closed_at, temporary_open_reason } = currentYear;

  const handleAction = async () => {
    setActionLoading(true);
    let result;
    
    switch (modalType) {
      case 'open':
        result = await openYear(currentYear.id);
        break;
      case 'close':
        result = await closeYear(currentYear.id, reason);
        break;
      case 'tempOpen':
        result = await temporaryOpen(currentYear.id, reason);
        break;
      case 'tempClose':
        result = await temporaryClose(currentYear.id);
        break;
    }
    
    setActionLoading(false);
    if (result?.success) {
      setShowModal(false);
      setReason('');
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setReason('');
    setShowModal(true);
  };

  const colorClasses = {
    green: 'border-green-500',
    yellow: 'border-yellow-500',
    red: 'border-red-500',
    blue: 'border-blue-500',
    gray: 'border-gray-500'
  };

  return (
    <>
      <div className={`bg-white rounded-lg shadow border-r-4 ${colorClasses[statusInfo?.color]} p-6`} dir={isAr ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{statusInfo?.icon}</span>
            <div>
              <h3 className="text-xl font-bold">
                {isAr ? 'السنة المالية' : 'Fiscal Year'} {year}
              </h3>
              <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                statusInfo?.color === 'green' ? 'bg-green-100 text-green-800' :
                statusInfo?.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                statusInfo?.color === 'red' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {isAr ? statusInfo?.label : statusInfo?.labelEn}
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FaInfoCircle />
            <span>{isAr ? statusInfo?.message : statusInfo?.messageEn}</span>
          </div>
          
          <div className="text-sm text-gray-500">
            {isAr ? 'الفترة:' : 'Period:'} {new Date(start_date).toLocaleDateString()} - {new Date(end_date).toLocaleDateString()}
          </div>

          {notes && (
            <div className="text-sm text-gray-500">
              {isAr ? 'ملاحظات:' : 'Notes:'} {notes}
            </div>
          )}

          {isTemporaryOpen && temporary_open_reason && (
            <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
              {isAr ? 'سبب الفتح المؤقت:' : 'Temporary open reason:'} {temporary_open_reason}
            </div>
          )}

          {closed_at && (
            <div className="text-sm text-gray-500">
              {isAr ? 'تاريخ الإغلاق:' : 'Closed at:'} {new Date(closed_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          {isClosed && !isTemporaryOpen && (
            <>
              <button
                onClick={() => openModal('open')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <FaLockOpen />
                {isAr ? 'فتح السنة المالية' : 'Open Fiscal Year'}
              </button>
              <button
                onClick={() => openModal('tempOpen')}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                <FaSync />
                {isAr ? 'فتح مؤقت' : 'Temporary Open'}
              </button>
            </>
          )}

          {isTemporaryOpen && (
            <button
              onClick={() => openModal('tempClose')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
            >
              <FaLock />
              {isAr ? 'إغلاق الفتح المؤقت' : 'Close Temporary'}
            </button>
          )}

          {canCreateEntries && currentYear.status === 'open' && (
            <button
              onClick={() => openModal('close')}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              <FaLock />
              {isAr ? 'إغلاق السنة المالية' : 'Close Fiscal Year'}
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" dir={isAr ? 'rtl' : 'ltr'}>
            <h3 className="text-lg font-bold mb-4">
              {modalType === 'open' && (isAr ? 'فتح السنة المالية' : 'Open Fiscal Year')}
              {modalType === 'close' && (isAr ? 'إغلاق السنة المالية' : 'Close Fiscal Year')}
              {modalType === 'tempOpen' && (isAr ? 'فتح مؤقت للسنة المالية' : 'Temporary Open')}
              {modalType === 'tempClose' && (isAr ? 'إغلاق الفتح المؤقت' : 'Close Temporary Opening')}
            </h3>

            {(modalType === 'close' || modalType === 'tempOpen') && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {modalType === 'close' 
                    ? (isAr ? 'ملاحظات الإغلاق:' : 'Closing notes:')
                    : (isAr ? 'سبب الفتح المؤقت:' : 'Reason for temporary open:')}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border rounded p-2"
                  rows={3}
                  required={modalType === 'tempOpen'}
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
                disabled={actionLoading}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleAction}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                disabled={actionLoading || (modalType === 'tempOpen' && !reason)}
              >
                {actionLoading ? (isAr ? 'جارٍ...' : 'Loading...') : (isAr ? 'تأكيد' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Inline warning for forms when fiscal year is closed
 */
export function FiscalYearWarning({ date, className = '' }) {
  const { canCreateForDate, currentYear } = useFiscalYear();
  const { lang } = useLang();
  const isAr = lang === 'ar';
  
  const [checkResult, setCheckResult] = useState(null);

  // Check when date changes
  useState(() => {
    if (date) {
      canCreateForDate(date).then(setCheckResult);
    }
  }, [date]);

  if (!checkResult || checkResult.canCreate) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 ${className}`}>
      <FaExclamationTriangle />
      <span>
        {isAr 
          ? `لا يمكن إنشاء قيود لهذا التاريخ: ${checkResult.reason}`
          : `Cannot create entries for this date: ${checkResult.reason}`
        }
      </span>
    </div>
  );
}

/**
 * Button wrapper that disables when fiscal year is closed
 */
export function FiscalYearProtectedButton({ 
  children, 
  onClick, 
  disabled = false,
  showWarning = true,
  ...props 
}) {
  const { canCreateEntries, currentYear } = useFiscalYear();
  const { lang } = useLang();
  const isAr = lang === 'ar';

  const isDisabled = disabled || !canCreateEntries;

  return (
    <div className="relative inline-block">
      <button
        {...props}
        onClick={onClick}
        disabled={isDisabled}
        className={`${props.className || ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isDisabled && !canCreateEntries 
          ? (isAr ? 'السنة المالية مغلقة' : 'Fiscal year is closed')
          : undefined
        }
      >
        {children}
      </button>
      {showWarning && !canCreateEntries && (
        <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3" title={isAr ? 'السنة مغلقة' : 'Year closed'} />
      )}
    </div>
  );
}

export default FiscalYearBanner;
