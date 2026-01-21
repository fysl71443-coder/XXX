/**
 * Fiscal Year Rollover Component
 * مكون ترحيل السنة المالية
 */

import { useState, useEffect } from 'react';
import { useFiscalYear } from '../context/FiscalYearContext';
import { useLang } from '../hooks/useLang';
import { 
  FaExchangeAlt, FaCheckCircle, FaTimesCircle, 
  FaSpinner, FaArrowRight, FaClipboardList
} from 'react-icons/fa';

/**
 * Rollover Modal
 */
export function RolloverModal({ fiscalYear, onClose, onSuccess }) {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  
  const [step, setStep] = useState('checklist'); // checklist, confirm, processing, done
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rolloverResult, setRolloverResult] = useState(null);
  const [error, setError] = useState(null);

  // Fetch checklist
  useEffect(() => {
    const fetchChecklist = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/fiscal-years/${fiscalYear.id}/checklist`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setChecklist(data);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    if (fiscalYear?.id) {
      fetchChecklist();
    }
  }, [fiscalYear?.id]);

  // Perform rollover
  const handleRollover = async () => {
    setStep('processing');
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/fiscal-years/${fiscalYear.id}/rollover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          target_year: fiscalYear.year + 1
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setRolloverResult(data);
        setStep('done');
        if (onSuccess) onSuccess(data);
      } else {
        const err = await res.json();
        setError(err.message || 'Error performing rollover');
        setStep('confirm');
      }
    } catch (e) {
      setError(e.message);
      setStep('confirm');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-primary-50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FaExchangeAlt className="text-primary-600" />
            {isAr ? 'ترحيل السنة المالية' : 'Fiscal Year Rollover'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FaTimesCircle className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step: Checklist */}
          {step === 'checklist' && (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-primary-100 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-primary-600">{fiscalYear.year}</div>
                    <div className="text-sm text-gray-600">{isAr ? 'السنة الحالية' : 'Current Year'}</div>
                  </div>
                  <FaArrowRight className="text-2xl text-gray-400" />
                  <div className="bg-green-100 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{fiscalYear.year + 1}</div>
                    <div className="text-sm text-gray-600">{isAr ? 'السنة الجديدة' : 'New Year'}</div>
                  </div>
                </div>

                <p className="text-gray-600">
                  {isAr 
                    ? 'سيتم ترحيل أرصدة الحسابات كأرصدة افتتاحية للسنة الجديدة.'
                    : 'Account balances will be rolled over as opening balances for the new year.'
                  }
                </p>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <FaSpinner className="animate-spin text-3xl text-primary-600 mx-auto" />
                </div>
              ) : checklist ? (
                <>
                  <div className="mb-4">
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <FaClipboardList />
                      {isAr ? 'قائمة التحقق قبل الترحيل' : 'Pre-Rollover Checklist'}
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      {checklist.checklist.map((item, idx) => (
                        <div 
                          key={item.id || idx}
                          className="flex items-center gap-3 py-2 border-b last:border-0"
                        >
                          {item.completed ? (
                            <FaCheckCircle className="text-green-500" />
                          ) : (
                            <FaTimesCircle className="text-red-500" />
                          )}
                          <span className={item.completed ? 'text-green-700' : 'text-red-700'}>
                            {isAr ? item.title : item.titleEn}
                          </span>
                          {item.count > 0 && !item.completed && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                              {item.count}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg mb-4">
                    <span>{isAr ? 'نسبة الإنجاز:' : 'Completion:'}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-300 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-600 rounded-full"
                          style={{ width: `${checklist.summary.percentage}%` }}
                        />
                      </div>
                      <span className="font-bold">{checklist.summary.percentage}%</span>
                    </div>
                  </div>

                  {!checklist.summary.canClose && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 mb-4">
                      {isAr 
                        ? 'يُنصح بإكمال جميع البنود قبل الترحيل. يمكنك المتابعة على مسؤوليتك.'
                        : 'It is recommended to complete all items before rollover. You can proceed at your own risk.'
                      }
                    </div>
                  )}
                </>
              ) : null}

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  {isAr ? 'متابعة' : 'Continue'}
                </button>
              </div>
            </>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && (
            <>
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold mb-2">
                  {isAr ? 'تأكيد الترحيل' : 'Confirm Rollover'}
                </h3>
                <p className="text-gray-600">
                  {isAr 
                    ? `هل أنت متأكد من ترحيل السنة ${fiscalYear.year} وإنشاء أرصدة افتتاحية للسنة ${fiscalYear.year + 1}؟`
                    : `Are you sure you want to rollover year ${fiscalYear.year} and create opening balances for ${fiscalYear.year + 1}?`
                  }
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 mb-4">
                  {error}
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setStep('checklist')}
                  className="px-6 py-2 border rounded hover:bg-gray-100"
                >
                  {isAr ? 'رجوع' : 'Back'}
                </button>
                <button
                  onClick={handleRollover}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  {isAr ? 'تأكيد الترحيل' : 'Confirm Rollover'}
                </button>
              </div>
            </>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div className="text-center py-12">
              <FaSpinner className="animate-spin text-5xl text-primary-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">
                {isAr ? 'جارٍ الترحيل...' : 'Processing Rollover...'}
              </h3>
              <p className="text-gray-600">
                {isAr ? 'يرجى الانتظار. قد تستغرق هذه العملية بضع ثوانٍ.' : 'Please wait. This may take a few seconds.'}
              </p>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && rolloverResult && (
            <>
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-green-600 mb-2">
                  {isAr ? 'تم الترحيل بنجاح!' : 'Rollover Completed!'}
                </h3>
              </div>

              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-sm text-gray-600">{isAr ? 'السنة المصدر' : 'Source Year'}</div>
                    <div className="text-2xl font-bold">{rolloverResult.sourceYear}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">{isAr ? 'السنة الهدف' : 'Target Year'}</div>
                    <div className="text-2xl font-bold">{rolloverResult.targetYear}</div>
                  </div>
                </div>
                <div className="text-center mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-600">{isAr ? 'عدد الحسابات المرحّلة' : 'Accounts Rolled Over'}</div>
                  <div className="text-3xl font-bold text-green-600">{rolloverResult.accountsRolledOver}</div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RolloverModal;
