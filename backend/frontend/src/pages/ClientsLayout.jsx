import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { FaUsers, FaFileInvoice, FaCheckCircle, FaHourglassHalf, FaCalendarAlt, FaMoneyBillWave, FaBell, FaQuestionCircle, FaPlus } from 'react-icons/fa'

export default function ClientsLayout(){
  const navigate = useNavigate()
  const lang = localStorage.getItem('lang')||'ar'
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <nav className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-700">{lang==='ar'?'وحدة العملاء':'Clients Module'}</h1>
          <div className="flex gap-2 items-center">
            <button className="px-3 py-1 rounded-md border" onClick={()=>{ const next = lang==='ar'?'en':'ar'; localStorage.setItem('lang', next); navigate(0) }}>{lang==='ar'?'English':'العربية'}</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-3">
          <div className="bg-white rounded-lg border shadow p-3 space-y-1">
            <div className="text-sm font-semibold text-gray-700 mb-2">{lang==='ar'?'الأقسام الرئيسية':'Main Sections'}</div>
            <NavLink to="/clients" end className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded ${isActive?'bg-primary-50 text-primary-700':'hover:bg-gray-50 text-gray-800'}`}><FaUsers/> {lang==='ar'?'الرئيسية':'Home'}</NavLink>
            <NavLink to="/clients/create" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded ${isActive?'bg-primary-50 text-primary-700':'hover:bg-gray-50 text-gray-800'}`}><FaPlus/> {lang==='ar'?'إضافة عميل':'Add Customer'}</NavLink>
            <div className="border-t my-2" />
            <NavLink to="/clients/cash" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded ${isActive?'bg-primary-50 text-primary-700':'hover:bg-gray-50 text-gray-800'}`}><FaFileInvoice/> {lang==='ar'?'فواتير المبيعات النقدية':'Cash Sales Invoices'}</NavLink>
            <NavLink to="/clients/credit" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded ${isActive?'bg-primary-50 text-primary-700':'hover:bg-gray-50 text-gray-800'}`}><FaFileInvoice/> {lang==='ar'?'فواتير المبيعات الآجلة':'Credit Sales Invoices'}</NavLink>
            <NavLink to="/clients/receivables" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded ${isActive?'bg-primary-50 text-primary-700':'hover:bg-gray-50 text-gray-800'}`}><FaHourglassHalf/> {lang==='ar'?'المستحقات':'Receivables'}</NavLink>
            <NavLink to="/clients/payments" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded ${isActive?'bg-primary-50 text-primary-700':'hover:bg-gray-50 text-gray-800'}`}><FaMoneyBillWave/> {lang==='ar'?'التحصيل والمدفوعات':'Collections & Payments'}</NavLink>
            <NavLink to="/clients/paid" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded ${isActive?'bg-primary-50 text-primary-700':'hover:bg-gray-50 text-gray-800'}`}><FaCheckCircle/> {lang==='ar'?'الفواتير المدفوعة':'Paid Invoices'}</NavLink>
            <NavLink to="/clients/statements" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded ${isActive?'bg-primary-50 text-primary-700':'hover:bg-gray-50 text-gray-800'}`}><FaCalendarAlt/> {lang==='ar'?'الكشوفات (للآجل)':'Statements (Credit)'}</NavLink>
          </div>
        </aside>
        <section className="col-span-12 md:col-span-9">
          <Outlet />
        </section>
      </main>
    </div>
  )
}