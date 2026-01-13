import './App.css';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { FaUsers, FaTruck, FaUserTie, FaReceipt, FaBox, FaCashRegister, FaShoppingCart, FaChartPie, FaCog } from 'react-icons/fa';
import { GiMoneyStack } from 'react-icons/gi';
import { settings as apiSettings } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import Clients from './pages/Clients';
import ClientCreate from './pages/ClientCreate';
import ClientsCards from './pages/ClientsCards';
import ClientsLayout from './pages/ClientsLayout';
import ClientsInvoicesAll from './pages/ClientsInvoicesAll';
import ClientsInvoicesPaid from './pages/ClientsInvoicesPaid';
import ClientsAging from './pages/ClientsAging';
import ClientsDue from './pages/ClientsDue';
import Suppliers from './pages/Suppliers';
import SuppliersCards from './pages/SuppliersCards';
import SupplierCreate from './pages/SupplierCreate';
import Products from './pages/Products';
import PurchaseOrders from './pages/PurchaseOrders';
import SalesOrders from './pages/SalesOrders';
import Sales from './pages/Sales';
import POSBranch from './pages/POSBranch';
import POSTables from './pages/POSTables';
import POSInvoice from './pages/POSInvoice';
import SalesOrderDetail from './pages/SalesOrderDetail';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail';
import CustomerInvoice from './pages/CustomerInvoice';
import SupplierInvoice from './pages/SupplierInvoice';
import Accounts from './pages/Accounts';
import AccountsScreen from './screens/AccountsScreen';
import Journal from './pages/Journal';
import Login from './pages/Login';
import Employees from './pages/Employees';
import EmployeesCards from './pages/EmployeesCards';
import EmployeeCreate from './pages/EmployeeCreate';
import EmployeeEdit from './pages/EmployeeEdit';
import EmployeeSettings from './pages/EmployeeSettings';
import PayrollPayments from './pages/PayrollPayments';
import PayrollStatements from './pages/PayrollStatements';
import PayrollDues from './pages/PayrollDues';
import PayrollRunForm from './pages/PayrollRunForm';
import Expenses from './pages/Expenses';
import ExpensesInvoices from './pages/ExpensesInvoices';
import POSManage from './pages/POSManage';
import BusinessDaySalesReport from './pages/BusinessDaySalesReport';
import Reports from './pages/Reports';
import PrintPreview from './pages/PrintPreview';
import Settings from './pages/Settings';

const modules = [
  { key: 'accounting', titleAr: 'المحاسبة', titleEn: 'Accounting', icon: GiMoneyStack, color: 'bg-primary-600' },
  { key: 'journal', titleAr: 'القيود اليومية', titleEn: 'Journal', icon: GiMoneyStack, color: 'bg-primary-600' },
  { key: 'clients', titleAr: 'العملاء', titleEn: 'Clients', icon: FaUsers, color: 'bg-primary-600' },
  { key: 'suppliers', titleAr: 'الموردون', titleEn: 'Suppliers', icon: FaTruck, color: 'bg-primary-600' },
  { key: 'employees', titleAr: 'الموظفون', titleEn: 'Employees', icon: FaUserTie, color: 'bg-primary-600' },
  { key: 'expenses', titleAr: 'المصروفات', titleEn: 'Expenses', icon: FaReceipt, color: 'bg-primary-600' },
  { key: 'products', titleAr: 'المنتجات', titleEn: 'Products', icon: FaBox, color: 'bg-primary-600' },
  { key: 'sales', titleAr: 'نقطة البيع', titleEn: 'Sales / POS', icon: FaCashRegister, color: 'bg-primary-600' },
  { key: 'purchase', titleAr: 'المشتريات', titleEn: 'Purchases', icon: FaShoppingCart, color: 'bg-primary-600' },
  { key: 'reports', titleAr: 'التقارير', titleEn: 'Reports', icon: FaChartPie, color: 'bg-primary-600' },
  { key: 'settings', titleAr: 'الإعدادات', titleEn: 'Settings', icon: FaCog, color: 'bg-primary-600' },
  
];

function Dashboard() {
  const navigate = useNavigate()
  const { logout, isLoggedIn, user, permissionsMap } = useAuth()
  const [lang, setLang] = useState(localStorage.getItem('lang')||'ar')
  useEffect(()=>{
    function onStorage(e){ if (e.key==='lang') setLang(e.newValue||'ar') }
    window.addEventListener('storage', onStorage)
    return ()=> window.removeEventListener('storage', onStorage)
  },[])
  useEffect(()=>{
    (async()=>{
      try {
        if (!isLoggedIn) return
        const b = await apiSettings.get('settings_branding')
        function isSameOrigin(u){ try { const url = new URL(u, window.location.origin); return url.origin === window.location.origin } catch { return false } }
        if (b && b.favicon && (String(b.favicon).startsWith('data:') || isSameOrigin(b.favicon))) {
          const link = document.querySelector("link[rel='icon']") || document.createElement('link')
          link.rel = 'icon'
          link.href = b.favicon
          document.head.appendChild(link)
        }
        if (b?.font) { document.body.style.fontFamily = `${b.font}, ${document.body.style.fontFamily||'inherit'}` }
      } catch {}
    })()
  },[isLoggedIn])
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-700">{lang==='ar'?'نظام ERP والمحاسبة':'ERP & Accounting System'}</h1>
          <div className="flex gap-2 items-center">
            <button className="px-3 py-1 rounded-md border" onClick={()=>{ const next = lang==='ar'?'en':'ar'; setLang(next); localStorage.setItem('lang', next) }}>{lang==='ar'?'English':'العربية'}</button>
            <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-700">{lang==='ar'?'متصل':'Online'}</span>
            <span className="px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">{lang==='ar'?'إشعارات':'Notifications'}</span>
            <button className="px-3 py-1 rounded-md border text-red-600 border-red-300" onClick={logout}>{lang==='ar'?'تسجيل الخروج':'Logout'}</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">{lang==='ar'?'لوحة التحكم':'Dashboard'}</h2>
          <p className="text-gray-600">{lang==='ar'?'اختر وحدة للعمل':'Choose a module'}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.filter(({ key }) => {
            const isAdmin = user?.isSuperAdmin === true || user?.isAdmin === true || String(user?.role||'').toLowerCase() === 'admin'
            if (isAdmin) return true
            const map = { clients:'clients', suppliers:'suppliers', employees:'employees', expenses:'expenses', products:'products', sales:'sales', purchase:'purchases', reports:'reports', accounting:'accounting', journal:'journal' }
            const sc = map[key]
            if (!sc) return true
            const perms = permissionsMap[String(sc)] || null
            if (!perms) return false
            if (sc === 'sales') {
              const branches = Object.keys(perms).filter(k => k !== '_global')
              return branches.some(b => Object.values(perms[b]||{}).some(v => v === true))
            }
            const g = perms._global || {}
            return Object.values(g).some(v => v === true)
          }).map(({ key, titleAr, titleEn, icon: Icon, color }) => (
            <motion.button
              key={key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative overflow-hidden rounded-xl bg-white border border-gray-200 shadow-sm"
              onClick={() => {
                if (key === 'clients') navigate('/clients')
                if (key === 'suppliers') navigate('/suppliers')
                if (key === 'products') navigate('/products')
                if (key === 'accounting') navigate('/accounting')
                if (key === 'journal') navigate('/journal')
                if (key === 'employees') navigate('/employees')
                if (key === 'expenses') navigate('/expenses')
                if (key === 'purchase') navigate('/supplier-invoices/new')
                if (key === 'reports') navigate('/reports')
                if (key === 'sales') navigate('/pos')
                if (key === 'settings') navigate('/settings')
                
              }}
            >
              <div className="p-6 flex items-center gap-4">
                <div className={`flex items-center justify-center w-12 h-12 rounded-lg text-white ${color}`}>
                  <Icon size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">{lang==='ar'?titleAr:titleEn}</h3>
                  <p className="text-sm text-gray-500">{lang==='ar'?'عرض التفاصيل، تعديل، حذف، إنشاء PDF':'View details, edit, delete, generate PDF'}</p>
                </div>
              </div>
              <div className="px-6 pb-4 flex gap-2">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">{lang==='ar'?'عرض':'View'}</span>
                <span className="px-3 py-1 bg-green-50 text-green-700 rounded-md text-xs">{lang==='ar'?'إنشاء':'Create'}</span>
                <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-md text-xs">PDF</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary-600 to-primary-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          ))}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
        <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounting" element={<AccountsScreen />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/clients" element={<ClientsLayout />}>
          <Route index element={<Clients />} />
          <Route path="cash" element={<Clients />} />
          <Route path="credit" element={<Clients />} />
          <Route path="receivables" element={<Clients />} />
          <Route path="payments" element={<Clients />} />
          <Route path="statements" element={<Clients />} />
          <Route path="invoices" element={<ClientsInvoicesAll />} />
          <Route path="paid" element={<ClientsInvoicesPaid />} />
          <Route path="aging" element={<ClientsAging />} />
          <Route path="due" element={<ClientsDue />} />
          <Route path="cards" element={<ClientsCards />} />
          <Route path="create" element={<ClientCreate />} />
        </Route>
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/cards" element={<SuppliersCards />} />
        <Route path="/suppliers/create" element={<SupplierCreate />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/products/sales-orders" element={<SalesOrders />} />
        <Route path="/products/sales-orders/:number" element={<SalesOrderDetail />} />
        <Route path="/products/purchase-orders/:id" element={<PurchaseOrderDetail />} />
        <Route path="/orders" element={<SalesOrders />} />
        <Route path="/orders/:id" element={<SalesOrderDetail />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/pos" element={<POSBranch />} />
        <Route path="/pos/:branch/tables" element={<POSTables />} />
        <Route path="/pos/:branch/tables/:table" element={<POSInvoice />} />
        <Route path="/pos/:branch/manage" element={<POSManage />} />
        <Route path="/invoices/new" element={<CustomerInvoice />} />
        <Route path="/supplier-invoices/new" element={<SupplierInvoice />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/employees/cards" element={<EmployeesCards />} />
        <Route path="/employees/new" element={<EmployeeCreate />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/expenses/invoices" element={<ExpensesInvoices />} />
        <Route path="/employees/:id/edit" element={<EmployeeEdit />} />
        <Route path="/employees/settings" element={<EmployeeSettings />} />
        <Route path="/payroll/payments" element={<PayrollPayments />} />
        <Route path="/payroll/statements" element={<PayrollStatements />} />
        <Route path="/payroll/dues" element={<PayrollDues />} />
        <Route path="/payroll/run/create" element={<PayrollRunForm />} />
        <Route path="/payroll/run/:id/edit" element={<PayrollRunForm />} />
        <Route path="/reports/business-day-sales" element={<BusinessDaySalesReport />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/debug/receipt-preview" element={<PrintPreview />} />
        <Route path="/settings" element={<Settings />} />
        
      </Routes>
        </ErrorBoundary>
    </BrowserRouter>
    </AuthProvider>
  )
}

export default App;
