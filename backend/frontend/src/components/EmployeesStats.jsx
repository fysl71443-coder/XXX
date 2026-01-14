import { Users, UserCheck, UserX, ShieldCheck } from 'lucide-react';

/**
 * Statistics cards component for employees page
 */
export default function EmployeesStats({ stats, lang }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div className="bg-white rounded shadow p-4 flex items-center justify-between">
        <div className="text-sm">
          <div className="text-gray-500">{lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'}</div>
          <div className="text-xl font-bold">{stats.total}</div>
        </div>
        <Users className="w-8 h-8 text-primary-600" />
      </div>
      
      <div className="bg-white rounded shadow p-4 flex items-center justify-between">
        <div className="text-sm">
          <div className="text-gray-500">{lang === 'ar' ? 'نشطون' : 'Active'}</div>
          <div className="text-xl font-bold">{stats.active}</div>
        </div>
        <UserCheck className="w-8 h-8 text-green-600" />
      </div>
      
      <div className="bg-white rounded shadow p-4 flex items-center justify-between">
        <div className="text-sm">
          <div className="text-gray-500">{lang === 'ar' ? 'منتهون' : 'Terminated'}</div>
          <div className="text-xl font-bold">{stats.terminated}</div>
        </div>
        <UserX className="w-8 h-8 text-rose-600" />
      </div>
      
      <div className="bg-white rounded shadow p-4 flex items-center justify-between">
        <div className="text-sm">
          <div className="text-gray-500">{lang === 'ar' ? 'سعوديون' : 'Saudi'}</div>
          <div className="text-xl font-bold">{stats.saudi}</div>
        </div>
        <ShieldCheck className="w-8 h-8 text-emerald-600" />
      </div>
      
      <div className="bg-white rounded shadow p-4 flex items-center justify-between">
        <div className="text-sm">
          <div className="text-gray-500">{lang === 'ar' ? 'إجمالي الراتب' : 'Gross Total'}</div>
          <div className="text-xl font-bold">{stats.grossTotal.toFixed(2)}</div>
        </div>
      </div>
    </section>
  );
}
