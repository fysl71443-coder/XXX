import { payroll as apiPayroll } from '../services/api';
import { useNavigate } from 'react-router-dom';

/**
 * Payroll runs table component
 */
export default function EmployeesPayrollRunsTable({ runs, canPayrollWrite, canEmployeesWrite, lang, onRefresh }) {
  const navigate = useNavigate();
  const handleApprove = async (run) => {
    try {
      if (run.status !== 'draft' || !canPayrollWrite) return;
      if (!window.confirm(lang === 'ar' ? 'تأكيد اعتماد المسير؟' : 'Confirm approve run?')) return;
      await apiPayroll.approve(run.id);
      onRefresh();
    } catch (e) {
      console.error('Failed to approve run:', e);
    }
  };

  const handlePost = async (run) => {
    try {
      if (run.status !== 'approved' || !canPayrollWrite) {
        return;
      }
      if (!window.confirm(lang === 'ar' ? 'تأكيد الترحيل المحاسبي؟ (سيتم استخدام تاريخ اليوم)' : 'Confirm posting? (Today\'s date will be used)')) {
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      await apiPayroll.post(run.id, { date });
      onRefresh();
    } catch (e) {
      console.error('Failed to post run:', e);
    }
  };

  return (
    <section className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">{lang === 'ar' ? 'مسير الرواتب' : 'Payroll'}</div>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!canPayrollWrite} onClick={() => { if (canPayrollWrite) navigate('/payroll/run/create') }}>{lang === 'ar' ? 'إنشاء مسير' : 'Create Run'}</button>
          <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!canPayrollWrite} onClick={() => { if (canPayrollWrite) navigate('/payroll/payments') }}>{lang === 'ar' ? 'سداد الرواتب' : 'Payroll Payments'}</button>
          <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!canPayrollWrite} onClick={() => { if (canPayrollWrite) navigate('/payroll/statements') }}>{lang === 'ar' ? 'كشوف الرواتب' : 'Payroll Statements'}</button>
          {canEmployeesWrite && (
            <button className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50" disabled={!canEmployeesWrite} onClick={() => { if (canEmployeesWrite) navigate('/employees/settings') }}>{lang === 'ar' ? 'إعدادات الموظفين' : 'Employee Settings'}</button>
          )}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2">{lang === 'ar' ? 'الفترة' : 'Period'}</th>
              <th className="p-2">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
              <th className="p-2">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(r => {
              // Use derived_status if available, otherwise fall back to status
              const displayStatus = r.derived_status || r.status;
              const isPosted = displayStatus === 'posted';
              const isApproved = displayStatus === 'approved';
              const isDraft = displayStatus === 'draft';
              
              return (
                <tr key={r.id} className="border-b">
                  <td className="p-2">{r.period}</td>
                  <td className="p-2">
                    <span className={isPosted ? 'px-2 py-1 rounded text-xs bg-green-100 text-green-700' : (isApproved ? 'px-2 py-1 rounded text-xs bg-blue-100 text-blue-700' : 'px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700')}>
                      {lang === 'ar' ? (isPosted ? 'منشور' : (isApproved ? 'معتمد' : 'مسودة')) : displayStatus}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button
                        className="px-2 py-1 bg-green-600 text-white rounded disabled:opacity-50"
                        disabled={!isDraft || !canPayrollWrite}
                        onClick={() => handleApprove(r)}
                      >
                        {lang === 'ar' ? 'اعتماد' : 'Approve'}
                      </button>
                      <button
                        className="px-2 py-1 bg-primary-600 text-white rounded disabled:opacity-50"
                        disabled={!isApproved || !canPayrollWrite}
                        onClick={() => handlePost(r)}
                      >
                        {isPosted ? (lang === 'ar' ? 'مُرحل' : 'Posted') : (lang === 'ar' ? 'ترحيل محاسبي' : 'Post')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
