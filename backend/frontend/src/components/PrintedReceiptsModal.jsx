/**
 * Printed Receipts Modal Component
 * مكون عرض الإيصالات المطبوعة
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLang } from '../hooks/useLang';
import { 
  FaPrint, FaTimes, FaSearch, FaCalendarAlt, 
  FaSpinner, FaReceipt, FaFilter, FaRedo
} from 'react-icons/fa';

/**
 * Main Modal Component
 */
export function PrintedReceiptsModal({ isOpen, onClose, branchId }) {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  
  // State
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInvoice, setSearchInvoice] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, today, month, year, custom
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [error, setError] = useState(null);
  const [printingId, setPrintingId] = useState(null);

  // Fetch receipts
  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      // Add search parameter
      if (searchInvoice.trim()) {
        params.append('invoiceNumber', searchInvoice.trim());
      }
      
      // Add branch filter
      if (branchId) {
        params.append('branch', branchId);
      }
      
      // Add date filters based on type
      const today = new Date();
      switch (filterType) {
        case 'today':
          params.append('date', today.toISOString().split('T')[0]);
          break;
        case 'month':
          params.append('month', filterMonth);
          params.append('year', filterYear);
          break;
        case 'year':
          params.append('year', filterYear);
          break;
        case 'custom':
          if (filterDate) {
            params.append('date', filterDate);
          }
          break;
        default:
          // 'all' - no date filter
          break;
      }
      
      const url = `/api/receipts${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setReceipts(Array.isArray(data) ? data : (data.items || data.receipts || []));
      } else {
        const err = await res.json();
        setError(err.message || (isAr ? 'خطأ في جلب الإيصالات' : 'Error fetching receipts'));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [searchInvoice, filterType, filterDate, filterMonth, filterYear, branchId, isAr]);

  // Fetch on open and filter change
  useEffect(() => {
    if (isOpen) {
      fetchReceipts();
    }
  }, [isOpen, fetchReceipts]);

  // Handle print receipt
  const handlePrint = useCallback(async (receipt) => {
    setPrintingId(receipt.id);
    
    try {
      // Create print window
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      
      if (!printWindow) {
        alert(isAr ? 'يرجى السماح بالنوافذ المنبثقة للطباعة' : 'Please allow popups to print');
        return;
      }

      // Use saved receipt HTML if available, otherwise generate new one
      const receiptHTML = receipt.receipt_html || generateReceiptHTML(receipt, isAr);
      
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Close after print dialog
          printWindow.onafterprint = () => printWindow.close();
          // Fallback close after 3 seconds
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
          }, 3000);
        }, 500);
      };
    } catch (e) {
      console.error('Print error:', e);
      alert(isAr ? 'خطأ في الطباعة' : 'Print error');
    } finally {
      setPrintingId(null);
    }
  }, [isAr]);

  // Filter display based on local search (for instant filtering)
  const filteredReceipts = useMemo(() => {
    if (!searchInvoice.trim()) return receipts;
    
    const search = searchInvoice.toLowerCase();
    return receipts.filter(r => 
      (r.invoice_number || r.invoiceNumber || '').toLowerCase().includes(search) ||
      (r.number || '').toLowerCase().includes(search)
    );
  }, [receipts, searchInvoice]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date
  const formatDateTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString(isAr ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FaReceipt />
            {isAr ? 'الإيصالات المطبوعة' : 'Printed Receipts'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 bg-gray-50 border-b space-y-3">
          {/* Search Row */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search by Invoice Number */}
            <div className="relative flex-1 min-w-[200px]">
              <FaSearch className="absolute top-1/2 -translate-y-1/2 text-gray-400 start-3" />
              <input
                type="text"
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                placeholder={isAr ? 'البحث برقم الفاتورة...' : 'Search by invoice number...'}
                className="w-full ps-10 pe-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchReceipts}
              disabled={loading}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              title={isAr ? 'تحديث' : 'Refresh'}
            >
              <FaRedo className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <FaFilter className="text-gray-500" />
              <span className="text-sm text-gray-600">
                {isAr ? 'فلترة:' : 'Filter:'}
              </span>
            </div>

            {/* Filter Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{isAr ? 'الكل' : 'All'}</option>
              <option value="today">{isAr ? 'اليوم' : 'Today'}</option>
              <option value="month">{isAr ? 'الشهر' : 'Month'}</option>
              <option value="year">{isAr ? 'السنة' : 'Year'}</option>
              <option value="custom">{isAr ? 'تاريخ محدد' : 'Custom Date'}</option>
            </select>

            {/* Month/Year selectors */}
            {filterType === 'month' && (
              <div className="flex gap-2">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(parseInt(e.target.value, 10))}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i).toLocaleString(isAr ? 'ar-SA' : 'en-US', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Year selector */}
            {filterType === 'year' && (
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}

            {/* Custom date picker */}
            {filterType === 'custom' && (
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FaSpinner className="animate-spin text-4xl text-blue-600 mb-4" />
              <p className="text-gray-500">
                {isAr ? 'جارٍ تحميل الإيصالات...' : 'Loading receipts...'}
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-red-500">
              <p>{error}</p>
              <button
                onClick={fetchReceipts}
                className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <FaReceipt className="text-6xl mb-4 opacity-30" />
              <p className="text-lg">
                {isAr ? 'لا توجد إيصالات مطبوعة' : 'No printed receipts'}
              </p>
              {searchInvoice && (
                <p className="text-sm mt-2">
                  {isAr ? 'جرّب البحث بكلمة أخرى' : 'Try a different search term'}
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">
                      #
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">
                      {isAr ? 'رقم الفاتورة' : 'Invoice Number'}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">
                      {isAr ? 'تاريخ ووقت الطباعة' : 'Print Date & Time'}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">
                      {isAr ? 'المبلغ' : 'Amount'}
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
                      {isAr ? 'الإجراء' : 'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((receipt, index) => (
                    <tr 
                      key={receipt.id || index}
                      className="border-b hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {receipt.invoice_number || receipt.invoiceNumber || receipt.number || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="text-gray-400" />
                          {formatDateTime(receipt.printed_at || receipt.printedAt || receipt.created_at || receipt.date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-600">
                        {formatCurrency(receipt.total || receipt.amount || receipt.grand_total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handlePrint(receipt)}
                          disabled={printingId === receipt.id}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {printingId === receipt.id ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            <FaPrint />
                          )}
                          <span className="hidden sm:inline">
                            {isAr ? 'طباعة' : 'Print'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between rounded-b-xl">
          <div className="text-sm text-gray-500">
            {isAr 
              ? `${filteredReceipts.length} إيصال`
              : `${filteredReceipts.length} receipt(s)`
            }
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate Receipt HTML for printing
 */
function generateReceiptHTML(receipt, isAr) {
  const companyName = receipt.company_name || receipt.companyName || 'اسم الشركة';
  const invoiceNumber = receipt.invoice_number || receipt.invoiceNumber || receipt.number || '';
  const date = new Date(receipt.printed_at || receipt.printedAt || receipt.created_at || receipt.date);
  const items = receipt.items || receipt.line_items || [];
  const subtotal = receipt.subtotal || receipt.sub_total || 0;
  const tax = receipt.tax || receipt.vat || 0;
  const total = receipt.total || receipt.amount || receipt.grand_total || 0;
  const customerName = receipt.customer_name || receipt.customerName || '';
  const paymentMethod = receipt.payment_method || receipt.paymentMethod || '';

  return `
<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head>
  <meta charset="UTF-8">
  <title>${isAr ? 'إيصال' : 'Receipt'} #${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      padding: 10px;
      max-width: 80mm;
      margin: 0 auto;
    }
    .header { text-align: center; margin-bottom: 15px; }
    .header h1 { font-size: 16px; margin-bottom: 5px; }
    .header p { color: #666; font-size: 11px; }
    .divider { border-top: 1px dashed #333; margin: 10px 0; }
    .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
    .info-label { color: #666; }
    .items { margin: 10px 0; }
    .item { display: flex; justify-content: space-between; padding: 3px 0; }
    .item-name { flex: 1; }
    .item-qty { width: 40px; text-align: center; }
    .item-price { width: 60px; text-align: ${isAr ? 'left' : 'right'}; }
    .totals { margin-top: 10px; }
    .total-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .grand-total { font-size: 14px; font-weight: bold; border-top: 1px solid #333; padding-top: 8px; margin-top: 5px; }
    .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #666; }
    @media print {
      body { padding: 0; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${companyName}</h1>
    <p>${isAr ? 'إيصال ضريبي مبسط' : 'Simplified Tax Invoice'}</p>
  </div>
  
  <div class="divider"></div>
  
  <div class="info">
    <div class="info-row">
      <span class="info-label">${isAr ? 'رقم الفاتورة:' : 'Invoice #:'}</span>
      <span>${invoiceNumber}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${isAr ? 'التاريخ:' : 'Date:'}</span>
      <span>${date.toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${isAr ? 'الوقت:' : 'Time:'}</span>
      <span>${date.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    ${customerName ? `
    <div class="info-row">
      <span class="info-label">${isAr ? 'العميل:' : 'Customer:'}</span>
      <span>${customerName}</span>
    </div>
    ` : ''}
    ${paymentMethod ? `
    <div class="info-row">
      <span class="info-label">${isAr ? 'الدفع:' : 'Payment:'}</span>
      <span>${paymentMethod}</span>
    </div>
    ` : ''}
  </div>
  
  <div class="divider"></div>
  
  <div class="items">
    <div class="item" style="font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
      <span class="item-name">${isAr ? 'الصنف' : 'Item'}</span>
      <span class="item-qty">${isAr ? 'الكمية' : 'Qty'}</span>
      <span class="item-price">${isAr ? 'السعر' : 'Price'}</span>
    </div>
    ${items.length > 0 ? items.map(item => `
    <div class="item">
      <span class="item-name">${item.name || item.product_name || item.productName || ''}</span>
      <span class="item-qty">${item.quantity || item.qty || 1}</span>
      <span class="item-price">${(item.total || item.price || 0).toFixed(2)}</span>
    </div>
    `).join('') : `
    <div class="item">
      <span class="item-name">-</span>
      <span class="item-qty">-</span>
      <span class="item-price">${total.toFixed(2)}</span>
    </div>
    `}
  </div>
  
  <div class="divider"></div>
  
  <div class="totals">
    ${subtotal ? `
    <div class="total-row">
      <span>${isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
      <span>${parseFloat(subtotal).toFixed(2)}</span>
    </div>
    ` : ''}
    ${tax ? `
    <div class="total-row">
      <span>${isAr ? 'الضريبة (15%):' : 'VAT (15%):'}</span>
      <span>${parseFloat(tax).toFixed(2)}</span>
    </div>
    ` : ''}
    <div class="total-row grand-total">
      <span>${isAr ? 'الإجمالي:' : 'Total:'}</span>
      <span>${parseFloat(total).toFixed(2)} ${isAr ? 'ر.س' : 'SAR'}</span>
    </div>
  </div>
  
  <div class="footer">
    <p>${isAr ? 'شكراً لزيارتكم' : 'Thank you for your visit'}</p>
    <p style="margin-top: 5px;">${isAr ? 'نتطلع لخدمتكم مجدداً' : 'We look forward to serving you again'}</p>
  </div>
</body>
</html>
  `;
}

/**
 * Button to open Printed Receipts Modal
 */
export function PrintedReceiptsButton({ branchId, className = '' }) {
  const [showModal, setShowModal] = useState(false);
  const { lang } = useLang();
  const isAr = lang === 'ar';

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors ${className}`}
      >
        <FaReceipt />
        <span>{isAr ? 'الإيصالات المطبوعة' : 'Printed Receipts'}</span>
      </button>

      <PrintedReceiptsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        branchId={branchId}
      />
    </>
  );
}

export default PrintedReceiptsModal;
