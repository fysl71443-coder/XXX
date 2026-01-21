/**
 * Data Import Page
 * شاشة استيراد البيانات من النظام القديم
 */

import { useState, useCallback } from 'react';
import { useFiscalYear } from '../context/FiscalYearContext';
import { FiscalYearBanner } from '../components/FiscalYearBanner';
import { useLang } from '../hooks/useLang';
import { useAuth } from '../context/AuthContext';
import { 
  FaUpload, FaFileExcel, FaFileCsv, FaCheckCircle, 
  FaTimesCircle, FaHome, FaArrowRight, FaDownload,
  FaExclamationTriangle, FaEdit, FaSave
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

export default function DataImport() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const { user } = useAuth();
  const isAr = lang === 'ar';
  
  const { currentYear, canCreateEntries, allYears } = useFiscalYear();

  const [importType, setImportType] = useState('journal'); // 'journal', 'invoices', 'expenses'
  const [selectedYear, setSelectedYear] = useState(currentYear?.year || new Date().getFullYear());
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [validationResults, setValidationResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [editingRow, setEditingRow] = useState(null);

  // Parse uploaded file
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFile(file);
    setParsedData([]);
    setValidationResults(null);
    setImportResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      // Map to standard format based on import type
      const mapped = jsonData.map((row, idx) => ({
        _rowNum: idx + 2, // Excel row number (1-based + header)
        _valid: true,
        _errors: [],
        ...mapRowToType(row, importType)
      }));

      setParsedData(mapped);
      
      // Validate data
      const validation = await validateData(mapped, importType);
      setValidationResults(validation);
    } catch (e) {
      console.error('Error parsing file:', e);
      alert(isAr ? 'خطأ في قراءة الملف' : 'Error reading file');
    }
  }, [importType, isAr]);

  // Map row data to standard format
  const mapRowToType = (row, type) => {
    switch (type) {
      case 'journal':
        return {
          date: row['التاريخ'] || row['Date'] || row['date'] || '',
          description: row['الوصف'] || row['Description'] || row['description'] || '',
          debit_account: row['حساب المدين'] || row['Debit Account'] || row['debit_account'] || '',
          credit_account: row['حساب الدائن'] || row['Credit Account'] || row['credit_account'] || '',
          amount: parseFloat(row['المبلغ'] || row['Amount'] || row['amount'] || 0),
          reference: row['المرجع'] || row['Reference'] || row['reference'] || ''
        };
      case 'invoices':
        return {
          date: row['التاريخ'] || row['Date'] || row['date'] || '',
          number: row['رقم الفاتورة'] || row['Invoice Number'] || row['number'] || '',
          customer: row['العميل'] || row['Customer'] || row['customer'] || '',
          total: parseFloat(row['الإجمالي'] || row['Total'] || row['total'] || 0),
          status: row['الحالة'] || row['Status'] || row['status'] || 'open'
        };
      case 'expenses':
        return {
          date: row['التاريخ'] || row['Date'] || row['date'] || '',
          description: row['الوصف'] || row['Description'] || row['description'] || '',
          amount: parseFloat(row['المبلغ'] || row['Amount'] || row['amount'] || 0),
          category: row['التصنيف'] || row['Category'] || row['category'] || '',
          account: row['الحساب'] || row['Account'] || row['account'] || ''
        };
      default:
        return row;
    }
  };

  // Validate data
  const validateData = async (data, type) => {
    const errors = [];
    const warnings = [];
    let validCount = 0;
    let invalidCount = 0;

    const token = localStorage.getItem('token');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowErrors = [];

      // Common validations
      if (!row.date) {
        rowErrors.push(isAr ? 'التاريخ مطلوب' : 'Date is required');
      } else {
        // Check if date is within selected year
        const year = new Date(row.date).getFullYear();
        if (year !== selectedYear) {
          rowErrors.push(isAr ? `التاريخ ليس في السنة ${selectedYear}` : `Date is not in year ${selectedYear}`);
        }
      }

      if (type === 'journal') {
        if (!row.description) rowErrors.push(isAr ? 'الوصف مطلوب' : 'Description is required');
        if (!row.debit_account) rowErrors.push(isAr ? 'حساب المدين مطلوب' : 'Debit account is required');
        if (!row.credit_account) rowErrors.push(isAr ? 'حساب الدائن مطلوب' : 'Credit account is required');
        if (!row.amount || row.amount <= 0) rowErrors.push(isAr ? 'المبلغ غير صالح' : 'Invalid amount');
      }

      if (type === 'invoices') {
        if (!row.number) rowErrors.push(isAr ? 'رقم الفاتورة مطلوب' : 'Invoice number is required');
        if (!row.customer) rowErrors.push(isAr ? 'العميل مطلوب' : 'Customer is required');
        if (!row.total || row.total <= 0) rowErrors.push(isAr ? 'الإجمالي غير صالح' : 'Invalid total');
      }

      if (type === 'expenses') {
        if (!row.description) rowErrors.push(isAr ? 'الوصف مطلوب' : 'Description is required');
        if (!row.amount || row.amount <= 0) rowErrors.push(isAr ? 'المبلغ غير صالح' : 'Invalid amount');
      }

      // Update row validation status
      data[i]._valid = rowErrors.length === 0;
      data[i]._errors = rowErrors;

      if (rowErrors.length > 0) {
        invalidCount++;
        errors.push({ row: row._rowNum, errors: rowErrors });
      } else {
        validCount++;
      }
    }

    return {
      total: data.length,
      valid: validCount,
      invalid: invalidCount,
      errors,
      warnings
    };
  };

  // Import data
  const handleImport = async () => {
    if (!validationResults || validationResults.invalid > 0) {
      alert(isAr ? 'يرجى إصلاح الأخطاء أولاً' : 'Please fix errors first');
      return;
    }

    setImporting(true);
    const token = localStorage.getItem('token');
    
    try {
      const validData = parsedData.filter(row => row._valid);
      
      // Call import API - all types use /api/import/{type}
      const endpoint = `/api/import/${importType}`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: validData,
          fiscal_year: selectedYear
        })
      });

      if (res.ok) {
        const result = await res.json();
        setImportResult({
          success: true,
          imported: result.imported || validData.length,
          message: isAr ? 'تم الاستيراد بنجاح' : 'Import successful'
        });
      } else {
        const error = await res.json();
        setImportResult({
          success: false,
          message: error.message || (isAr ? 'فشل الاستيراد' : 'Import failed')
        });
      }
    } catch (e) {
      setImportResult({
        success: false,
        message: e.message
      });
    } finally {
      setImporting(false);
    }
  };

  // Download template
  const downloadTemplate = () => {
    let template = [];
    
    switch (importType) {
      case 'journal':
        template = [
          { 'التاريخ': '2025-01-15', 'الوصف': 'قيد مثال', 'حساب المدين': '1111', 'حساب الدائن': '4111', 'المبلغ': 1000, 'المرجع': 'REF001' }
        ];
        break;
      case 'invoices':
        template = [
          { 'التاريخ': '2025-01-15', 'رقم الفاتورة': 'INV001', 'العميل': 'عميل مثال', 'الإجمالي': 1500, 'الحالة': 'open' }
        ];
        break;
      case 'expenses':
        template = [
          { 'التاريخ': '2025-01-15', 'الوصف': 'مصروف مثال', 'المبلغ': 500, 'التصنيف': 'عام', 'الحساب': '5100' }
        ];
        break;
    }

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${importType}_template.xlsx`);
  };

  // Update row data
  const updateRow = (rowNum, field, value) => {
    setParsedData(prev => prev.map(row => {
      if (row._rowNum === rowNum) {
        const updated = { ...row, [field]: value };
        // Re-validate
        const rowErrors = [];
        if (!updated.date) rowErrors.push(isAr ? 'التاريخ مطلوب' : 'Date is required');
        if (importType === 'journal') {
          if (!updated.amount || updated.amount <= 0) rowErrors.push(isAr ? 'المبلغ غير صالح' : 'Invalid amount');
        }
        updated._errors = rowErrors;
        updated._valid = rowErrors.length === 0;
        return updated;
      }
      return row;
    }));
    
    // Update validation results
    const newValid = parsedData.filter(r => r._valid || (r._rowNum === rowNum)).length;
    setValidationResults(prev => prev ? {
      ...prev,
      valid: newValid,
      invalid: prev.total - newValid
    } : null);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-200 rounded">
            <FaHome className="text-xl" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FaUpload className="text-primary-600" />
              {isAr ? 'استيراد البيانات' : 'Data Import'}
            </h1>
            <p className="text-gray-600">
              {isAr ? 'استيراد القيود والفواتير من النظام القديم' : 'Import entries and invoices from old system'}
            </p>
          </div>
        </div>
      </div>

      {/* Fiscal Year Banner */}
      <FiscalYearBanner className="mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">{isAr ? 'إعدادات الاستيراد' : 'Import Settings'}</h2>

          {/* Import Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">{isAr ? 'نوع البيانات:' : 'Data Type:'}</label>
            <select
              value={importType}
              onChange={(e) => {
                setImportType(e.target.value);
                setFile(null);
                setParsedData([]);
                setValidationResults(null);
              }}
              className="w-full border rounded p-2"
            >
              <option value="journal">{isAr ? 'قيود يومية' : 'Journal Entries'}</option>
              <option value="invoices">{isAr ? 'فواتير' : 'Invoices'}</option>
              <option value="expenses">{isAr ? 'مصروفات' : 'Expenses'}</option>
            </select>
          </div>

          {/* Year Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">{isAr ? 'السنة المالية:' : 'Fiscal Year:'}</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="w-full border rounded p-2"
            >
              {allYears.map(y => (
                <option key={y.id} value={y.year}>
                  {y.year} - {isAr ? y.statusInfo?.label : y.statusInfo?.labelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Download Template */}
          <button
            onClick={downloadTemplate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded mb-4 hover:bg-gray-50"
          >
            <FaDownload />
            {isAr ? 'تحميل القالب' : 'Download Template'}
          </button>

          {/* File Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">{isAr ? 'اختر ملف:' : 'Select File:'}</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="w-full border rounded p-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              {isAr ? 'الصيغ المدعومة: Excel (.xlsx, .xls), CSV' : 'Supported formats: Excel (.xlsx, .xls), CSV'}
            </p>
          </div>

          {/* Validation Summary */}
          {validationResults && (
            <div className="border rounded p-4 mb-4">
              <h3 className="font-medium mb-2">{isAr ? 'نتيجة التحقق:' : 'Validation Result:'}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{isAr ? 'الإجمالي:' : 'Total:'}</span>
                  <span>{validationResults.total}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span><FaCheckCircle className="inline mr-1" />{isAr ? 'صالح:' : 'Valid:'}</span>
                  <span>{validationResults.valid}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span><FaTimesCircle className="inline mr-1" />{isAr ? 'غير صالح:' : 'Invalid:'}</span>
                  <span>{validationResults.invalid}</span>
                </div>
              </div>
            </div>
          )}

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={!validationResults || validationResults.invalid > 0 || importing}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded text-white ${
              validationResults && validationResults.invalid === 0 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {importing ? (
              <FaSync className="animate-spin" />
            ) : (
              <FaUpload />
            )}
            {importing 
              ? (isAr ? 'جارٍ الاستيراد...' : 'Importing...') 
              : (isAr ? 'استيراد البيانات' : 'Import Data')}
          </button>

          {/* Import Result */}
          {importResult && (
            <div className={`mt-4 p-4 rounded ${importResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {importResult.success ? <FaCheckCircle className="inline mr-2" /> : <FaTimesCircle className="inline mr-2" />}
              {importResult.message}
              {importResult.imported && (
                <div className="text-sm mt-1">
                  {isAr ? `تم استيراد ${importResult.imported} سجل` : `Imported ${importResult.imported} records`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Data Preview */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">{isAr ? 'معاينة البيانات' : 'Data Preview'}</h2>

          {parsedData.length === 0 ? (
            <div className="text-center text-gray-500 py-16">
              <FaFileExcel className="text-5xl mx-auto mb-4" />
              <p>{isAr ? 'اختر ملف للمعاينة' : 'Select a file to preview'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-start">#</th>
                    <th className="p-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                    {importType === 'journal' && (
                      <>
                        <th className="p-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                        <th className="p-2 text-start">{isAr ? 'الوصف' : 'Description'}</th>
                        <th className="p-2 text-start">{isAr ? 'مدين' : 'Debit'}</th>
                        <th className="p-2 text-start">{isAr ? 'دائن' : 'Credit'}</th>
                        <th className="p-2 text-start">{isAr ? 'المبلغ' : 'Amount'}</th>
                      </>
                    )}
                    {importType === 'invoices' && (
                      <>
                        <th className="p-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                        <th className="p-2 text-start">{isAr ? 'الرقم' : 'Number'}</th>
                        <th className="p-2 text-start">{isAr ? 'العميل' : 'Customer'}</th>
                        <th className="p-2 text-start">{isAr ? 'الإجمالي' : 'Total'}</th>
                      </>
                    )}
                    {importType === 'expenses' && (
                      <>
                        <th className="p-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                        <th className="p-2 text-start">{isAr ? 'الوصف' : 'Description'}</th>
                        <th className="p-2 text-start">{isAr ? 'المبلغ' : 'Amount'}</th>
                        <th className="p-2 text-start">{isAr ? 'التصنيف' : 'Category'}</th>
                      </>
                    )}
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className={`border-b ${row._valid ? '' : 'bg-red-50'}`}>
                      <td className="p-2">{row._rowNum}</td>
                      <td className="p-2">
                        {row._valid ? (
                          <FaCheckCircle className="text-green-500" />
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <FaTimesCircle />
                            <span className="text-xs">{row._errors[0]}</span>
                          </span>
                        )}
                      </td>
                      {importType === 'journal' && (
                        <>
                          <td className="p-2">{row.date}</td>
                          <td className="p-2">{row.description}</td>
                          <td className="p-2">{row.debit_account}</td>
                          <td className="p-2">{row.credit_account}</td>
                          <td className="p-2">{row.amount}</td>
                        </>
                      )}
                      {importType === 'invoices' && (
                        <>
                          <td className="p-2">{row.date}</td>
                          <td className="p-2">{row.number}</td>
                          <td className="p-2">{row.customer}</td>
                          <td className="p-2">{row.total}</td>
                        </>
                      )}
                      {importType === 'expenses' && (
                        <>
                          <td className="p-2">{row.date}</td>
                          <td className="p-2">{row.description}</td>
                          <td className="p-2">{row.amount}</td>
                          <td className="p-2">{row.category}</td>
                        </>
                      )}
                      <td className="p-2">
                        <button
                          onClick={() => setEditingRow(editingRow === row._rowNum ? null : row._rowNum)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <FaEdit />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {parsedData.length > 100 && (
                <div className="text-center text-gray-500 py-4">
                  {isAr ? `يتم عرض أول 100 سجل من ${parsedData.length}` : `Showing first 100 of ${parsedData.length} records`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
