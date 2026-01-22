import './App.css';
import { motion } from 'framer-motion';
import { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { FaUsers, FaTruck, FaUserTie, FaReceipt, FaBox, FaCashRegister, FaShoppingCart, FaChartPie, FaCog, FaCalendarAlt } from 'react-icons/fa';
import { GiMoneyStack } from 'react-icons/gi';
import { settings as apiSettings } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FiscalYearProvider } from './context/FiscalYearContext';
import ErrorBoundary from './ErrorBoundary';
import AuthGate from './components/AuthGate';
import { useLang } from './hooks/useLang';
import { isAdmin } from './utils/auth.js';

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientCreate = lazy(() => import('./pages/ClientCreate'));
const ClientsCards = lazy(() => import('./pages/ClientsCards'));
const ClientsLayout = lazy(() => import('./pages/ClientsLayout'));
const ClientsInvoicesAll = lazy(() => import('./pages/ClientsInvoicesAll'));
const ClientsInvoicesPaid = lazy(() => import('./pages/ClientsInvoicesPaid'));
const ClientsAging = lazy(() => import('./pages/ClientsAging'));
const ClientsDue = lazy(() => import('./pages/ClientsDue'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const SuppliersCards = lazy(() => import('./pages/SuppliersCards'));
const SupplierCreate = lazy(() => import('./pages/SupplierCreate'));
const Products = lazy(() => import('./pages/Products'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const SalesOrders = lazy(() => import('./pages/SalesOrders'));
const Sales = lazy(() => import('./pages/Sales'));
const POSBranch = lazy(() => import('./pages/POSBranch'));
const POSTables = lazy(() => import('./pages/POSTables'));
const POSInvoice = lazy(() => import('./pages/POSInvoice'));
const SalesOrderDetail = lazy(() => import('./pages/SalesOrderDetail'));
const PurchaseOrderDetail = lazy(() => import('./pages/PurchaseOrderDetail'));
const CustomerInvoice = lazy(() => import('./pages/CustomerInvoice'));
const SupplierInvoice = lazy(() => import('./pages/SupplierInvoice'));
const Accounts = lazy(() => import('./pages/Accounts'));
const AccountsScreen = lazy(() => import('./screens/AccountsScreen'));
const Journal = lazy(() => import('./pages/Journal'));
const Employees = lazy(() => import('./pages/Employees'));
const EmployeesCards = lazy(() => import('./pages/EmployeesCards'));
const EmployeeCreate = lazy(() => import('./pages/EmployeeCreate'));
const EmployeeEdit = lazy(() => import('./pages/EmployeeEdit'));
const EmployeeSettings = lazy(() => import('./pages/EmployeeSettings'));
const PayrollPayments = lazy(() => import('./pages/PayrollPayments'));
const PayrollStatements = lazy(() => import('./pages/PayrollStatements'));
const PayrollDues = lazy(() => import('./pages/PayrollDues'));
const PayrollRunForm = lazy(() => import('./pages/PayrollRunForm'));
const Expenses = lazy(() => import('./pages/Expenses'));
const ExpensesInvoices = lazy(() => import('./pages/ExpensesInvoices'));
const POSManage = lazy(() => import('./pages/POSManage'));
const BusinessDaySalesReport = lazy(() => import('./pages/BusinessDaySalesReport'));
const Reports = lazy(() => import('./pages/Reports'));
const PrintPreview = lazy(() => import('./pages/PrintPreview'));
const Settings = lazy(() => import('./pages/Settings'));
const FiscalYearManagement = lazy(() => import('./pages/FiscalYearManagement'));
const DataImport = lazy(() => import('./pages/DataImport'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-pulse text-gray-600">جار التحميل...</div>
  </div>
);

const modules = [
  { key: 'accounting', titleAr: 'المحاسبة', titleEn: 'Accounting', icon: GiMoneyStack, color: 'bg-primary-600' },
  { key: 'journal', titleAr: 'القيود اليومية', titleEn: 'Journal', icon: GiMoneyStack, color: 'bg-primary-600' },
  { key: 'fiscal_years', titleAr: 'السنوات المالية', titleEn: 'Fiscal Years', icon: FaCalendarAlt, color: 'bg-purple-600' },
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
  const { lang, setLanguage } = useLang()
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
            <button className="px-3 py-1 rounded-md border" onClick={()=>{ setLanguage(lang==='ar'?'en':'ar') }}>{lang==='ar'?'English':'العربية'}</button>
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
            const userIsAdmin = isAdmin(user);
            if (userIsAdmin) return true
            // Fiscal years should be visible to admins and users with accounting permissions
            if (key === 'fiscal_years') {
              const accountingPerms = permissionsMap['accounting'] || null;
              if (!accountingPerms) return false;
              const g = accountingPerms._global || {};
              return Object.values(g).some(v => v === true);
            }
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
                if (key === 'fiscal_years') navigate('/fiscal-years')
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
                  <p className="text-sm text-gray-500">
                    {key === 'fiscal_years' 
                      ? (lang==='ar'?'إدارة السنوات المالية وترحيلها':'Manage and rollover fiscal years')
                      : (lang==='ar'?'عرض التفاصيل، تعديل، حذف، إنشاء PDF':'View details, edit, delete, generate PDF')
                    }
                  </p>
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
  // Log app initialization
  useEffect(() => {
    console.log('[App] Application initialized', {
      path: window.location.pathname,
      hasToken: !!localStorage.getItem('token'),
      timestamp: new Date().toISOString()
    });
  }, []);
  
  return (
    <AuthProvider>
      <FiscalYearProvider>
      <BrowserRouter>
        <ErrorBoundary>
        {/* AuthGate blocks ALL rendering until auth state is determined */}
        <AuthGate>
        <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* All routes below are protected - AuthGate ensures user is authenticated */}
          <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/accounts" element={<ErrorBoundary><Accounts /></ErrorBoundary>} />
          <Route path="/accounting" element={<ErrorBoundary><AccountsScreen /></ErrorBoundary>} />
          <Route path="/journal" element={<ErrorBoundary><Journal /></ErrorBoundary>} />
          <Route path="/clients" element={<ErrorBoundary><ClientsLayout /></ErrorBoundary>}>
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
          <Route path="/suppliers" element={<ErrorBoundary><Suppliers /></ErrorBoundary>} />
          <Route path="/suppliers/cards" element={<ErrorBoundary><SuppliersCards /></ErrorBoundary>} />
          <Route path="/suppliers/create" element={<ErrorBoundary><SupplierCreate /></ErrorBoundary>} />
          <Route path="/products" element={<ErrorBoundary><Products /></ErrorBoundary>} />
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
          <Route path="/employees" element={<ErrorBoundary><Employees /></ErrorBoundary>} />
          <Route path="/employees/cards" element={<ErrorBoundary><EmployeesCards /></ErrorBoundary>} />
          <Route path="/employees/new" element={<ErrorBoundary><EmployeeCreate /></ErrorBoundary>} />
          <Route path="/expenses" element={<ErrorBoundary><Expenses /></ErrorBoundary>} />
          <Route path="/expenses/invoices" element={<ErrorBoundary><ExpensesInvoices /></ErrorBoundary>} />
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
          <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          <Route path="/fiscal-years" element={<ErrorBoundary><FiscalYearManagement /></ErrorBoundary>} />
          <Route path="/data-import" element={<ErrorBoundary><DataImport /></ErrorBoundary>} />
        </Routes>
        </Suspense>
        </AuthGate>
        </ErrorBoundary>
    </BrowserRouter>
      </FiscalYearProvider>
    </AuthProvider>
  )
}

export default App;
