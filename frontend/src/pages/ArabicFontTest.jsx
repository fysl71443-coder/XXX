import React, { useState, useEffect } from 'react';
import { generateArabicPdf, generateMixedPdf } from '../printing/pdf/autoPdf';

const ArabicFontTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fontStatus, setFontStatus] = useState([]);

  // قائمة بجميع أنواع التقارير المحاسبية
  const reportTypes = [
    {
      id: 'journal',
      name: 'قيود يومية',
      arabicName: 'سجل القيود اليومية',
      description: 'تقرير القيود المحاسبية اليومية'
    },
    {
      id: 'ledger',
      name: 'حسابات الأستاذ',
      arabicName: 'أستاذ الحسابات',
      description: 'كشف حسابات الأستاذ العامة'
    },
    {
      id: 'trialBalance',
      name: 'ميزان المراجعة',
      arabicName: 'ميزان المراجعة',
      description: 'ميزان مراجعة الحسابات'
    },
    {
      id: 'income',
      name: 'قائمة الدخل',
      arabicName: 'قائمة الدخل',
      description: 'قائمة الدخل والمصاريف'
    },
    {
      id: 'balanceSheet',
      name: 'الميزانية العمومية',
      arabicName: 'الميزانية العمومية',
      description: 'الميزانية العمومية للشركة'
    },
    {
      id: 'cashFlow',
      name: 'التدفقات النقدية',
      arabicName: 'تقرير التدفقات النقدية',
      description: 'تقرير التدفقات النقدية'
    },
    {
      id: 'vat',
      name: 'الضريبة المضافة',
      arabicName: 'تقرير الضريبة المضافة',
      description: 'تقرير ضريبة القيمة المضافة'
    },
    {
      id: 'inventory',
      name: 'المخزون',
      arabicName: 'تقرير المخزون',
      description: 'تقرير جرد المخزون'
    },
    {
      id: 'customers',
      name: 'العملاء',
      arabicName: 'تقرير العملاء',
      description: 'تقرير حسابات العملاء'
    },
    {
      id: 'suppliers',
      name: 'الموردين',
      arabicName: 'تقرير الموردين',
      description: 'تقرير حسابات الموردين'
    },
    {
      id: 'payroll',
      name: 'الرواتب',
      arabicName: 'تقرير الرواتب',
      description: 'تقرير رواتب الموظفين'
    },
    {
      id: 'sales',
      name: 'المبيعات',
      arabicName: 'تقرير المبيعات',
      description: 'تقرير المبيعات والإيرادات'
    },
    {
      id: 'purchases',
      name: 'المشتريات',
      arabicName: 'تقرير المشتريات',
      description: 'تقرير المشتريات والمصروفات'
    },
    {
      id: 'pos',
      name: 'نقاط البيع',
      arabicName: 'تقرير نقاط البيع',
      description: 'تقرير مبيعات نقاط البيع'
    }
  ];

  const checkFontAvailability = async () => {
    const fonts = [
      { name: 'Amiri-Regular.ttf', path: '/fonts/Amiri-Regular.ttf', priority: 1 },
      { name: 'Cairo-Regular.ttf', path: '/fonts/Cairo-Regular.ttf', priority: 2 },
      { name: 'Cairo-Regular.woff2', path: '/fonts/Cairo-Regular.woff2', priority: 3 }
    ];
    
    const results = await Promise.all(
      fonts.map(async (font) => {
        try {
          const response = await fetch(font.path, { method: 'HEAD' });
          return { ...font, available: response.ok };
        } catch {
          return { ...font, available: false };
        }
      })
    );
    
    setFontStatus(results);
    return results;
  };

  const generateReport = async (reportType) => {
    try {
      let content = [];
      
      // محتوى مخصص لكل نوع تقرير
      switch (reportType.id) {
        case 'journal':
          content = [
            { text: reportType.arabicName, alignment: 'right', rtl: true, fontSize: 18, bold: true, margin: [0, 0, 0, 20] },
            { text: `تقرير القيود اليومية للفترة من ١/١/٢٠٢٤ إلى ٣١/١/٢٠٢٤`, alignment: 'right', rtl: true, fontSize: 12, margin: [0, 0, 0, 15] },
            {
              table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto', 'auto'],
                body: [
                  [
                    { text: 'رقم القيد', alignment: 'center', bold: true },
                    { text: 'الوصف', alignment: 'center', bold: true },
                    { text: 'التاريخ', alignment: 'center', bold: true },
                    { text: 'مدين', alignment: 'center', bold: true },
                    { text: 'دائن', alignment: 'center', bold: true }
                  ],
                  ['001', 'قيد افتتاحي', '٠١/٠١/٢٠٢٤', '١٠٠٠٠٠', ''],
                  ['002', 'مبيعات نقدية', '٠١/٠١/٢٠٢٤', '', '٥٠٠٠'],
                  ['003', 'مصاريف إدارية', '٠٢/٠١/٢٠٢٤', '٢٠٠٠', ''],
                  ['004', 'مشتريات بضاعة', '٠٢/٠١/٢٠٢٤', '٨٠٠٠', '']
                ]
              },
              margin: [0, 10, 0, 10]
            }
          ];
          break;
          
        case 'trialBalance':
          content = [
            { text: reportType.arabicName, alignment: 'right', rtl: true, fontSize: 18, bold: true, margin: [0, 0, 0, 20] },
            { text: `ميزان مراجعة في ٣١/١/٢٠٢٤`, alignment: 'right', rtl: true, fontSize: 12, margin: [0, 0, 0, 15] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                body: [
                  [
                    { text: 'اسم الحساب', alignment: 'center', bold: true },
                    { text: 'رقم الحساب', alignment: 'center', bold: true },
                    { text: 'رصيد مدين', alignment: 'center', bold: true },
                    { text: 'رصيد دائن', alignment: 'center', bold: true },
                    { text: 'الرصيد', alignment: 'center', bold: true }
                  ],
                  ['النقدية والبنوك', '101', '٥٠٠٠٠', '', 'مدين'],
                  ['العملاء', '102', '٣٠٠٠٠', '', 'مدين'],
                  ['المخزون', '103', '٤٥٠٠٠', '', 'مدين'],
                  ['الأصول الثابتة', '104', '١٠٠٠٠٠', '', 'مدين'],
                  ['الموردين', '201', '', '٢٥٠٠٠', 'دائن'],
                  ['القروض', '202', '', '٥٠٠٠٠', 'دائن'],
                  ['رأس المال', '301', '', '١٥٠٠٠٠', 'دائن']
                ]
              },
              margin: [0, 10, 0, 10]
            }
          ];
          break;
          
        case 'income':
          content = [
            { text: reportType.arabicName, alignment: 'right', rtl: true, fontSize: 18, bold: true, margin: [0, 0, 0, 20] },
            { text: `قائمة الدخل للسنة المنتهية في ٣١/١٢/٢٠٢٤`, alignment: 'right', rtl: true, fontSize: 12, margin: [0, 0, 0, 15] },
            {
              table: {
                headerRows: 1,
                widths: ['*', 'auto'],
                body: [
                  [
                    { text: 'البند', alignment: 'center', bold: true },
                    { text: 'المبلغ (ريال)', alignment: 'center', bold: true }
                  ],
                  ['المبيعات', '٥٠٠٠٠٠'],
                  ['(-) تكلفة المبيعات', '٣٠٠٠٠٠'],
                  ['(=) إجمالي الربح', '٢٠٠٠٠٠'],
                  ['(-) المصاريف الإدارية', '٥٠٠٠٠'],
                  ['(-) المصاريف التسويقية', '٣٠٠٠٠'],
                  ['(+) الإيرادات الأخرى', '١٠٠٠٠'],
                  ['(=) صافي الربح', '١٣٠٠٠٠']
                ]
              },
              margin: [0, 10, 0, 10]
            }
          ];
          break;
          
        default:
          // محتوى افتراضي للتقارير الأخرى
          content = [
            { text: reportType.arabicName, alignment: 'right', rtl: true, fontSize: 18, bold: true, margin: [0, 0, 0, 20] },
            { text: reportType.description, alignment: 'right', rtl: true, fontSize: 12, margin: [0, 0, 0, 15] },
            { text: 'هذا تقرير تجريبي لاختبار عرض النصوص العربية بخط Amiri', alignment: 'right', rtl: true, fontSize: 11, margin: [0, 0, 0, 10] },
            { text: 'رقم التقرير: 2024-001', alignment: 'right', rtl: true, fontSize: 11 },
            { text: 'تاريخ الإصدار: ١٥/١٢/٢٠٢٤', alignment: 'right', rtl: true, fontSize: 11 },
            { text: 'إجمالي المبالغ: ١٠٠٠٠٠ ريال سعودي', alignment: 'right', rtl: true, fontSize: 11 }
          ];
      }

      const docDefinition = {
        defaultStyle: {
          font: 'Cairo', // سيتم استخدام الخط المتاح تلقائياً
          fontSize: 11,
        },
        content: content,
        pageOrientation: 'portrait',
        pageMargins: [40, 60, 40, 60],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            alignment: 'center',
            margin: [0, 0, 0, 10]
          },
          arabicText: {
            alignment: 'right',
            rtl: true
          }
        }
      };

      // استخدام pdfMake مباشرة
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const { initPdfFonts } = await import('../printing/pdf/font-loader');
      
      await initPdfFonts();
      
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      
      return new Promise((resolve, reject) => {
        pdfDocGenerator.getBlob((blob) => {
          resolve(blob);
        }, (error) => {
          reject(error);
        });
      });
      
    } catch (error) {
      console.error(`Error generating ${reportType.id} report:`, error);
      throw error;
    }
  };

  const testAllReports = async () => {
    setLoading(true);
    const results = [];

    for (const reportType of reportTypes) {
      try {
        const blob = await generateReport(reportType);
        
        // إنشاء رابط تحميل مؤقت
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportType.id}-report-${Date.now()}.pdf`;
        
        results.push({
          reportType,
          success: true,
          blob,
          downloadUrl: url,
          message: `تم إنشاء تقرير ${reportType.arabicName} بنجاح`
        });
        
      } catch (error) {
        results.push({
          reportType,
          success: false,
          message: `فشل إنشاء تقرير ${reportType.arabicName}: ${error.message}`
        });
      }
    }

    setTestResults(results);
    setLoading(false);
  };

  const downloadReport = (result) => {
    if (result.downloadUrl) {
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = `${result.reportType.id}-report-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    checkFontAvailability();
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
        اختبار الخط العربي في جميع التقارير المحاسبية
      </h1>
      
      <div className="mb-6 bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">حالة الخطوط:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {fontStatus.map((font, index) => (
            <div key={index} className={`p-3 rounded ${font.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <span className="font-medium">{font.name}:</span>
              <span className={`ml-2 ${font.available ? 'text-green-600' : 'text-red-600'}`}>
                {font.available ? '✓ متاح' : '✗ غير متاح'}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mb-6">
        <button
          onClick={testAllReports}
          disabled={loading}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-lg font-semibold"
        >
          {loading ? 'جاري اختبار جميع التقارير...' : 'اختبار جميع التقارير'}
        </button>
      </div>

      {testResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">نتائج الاختبارات:</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testResults.map((result, index) => (
              <div key={index} className={`p-4 rounded-lg border ${
                result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-lg">{result.reportType.arabicName}</h4>
                  {result.success && (
                    <button
                      onClick={() => downloadReport(result)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      تحميل
                    </button>
                  )}
                </div>
                <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.message}
                </p>
                <p className="text-xs text-gray-500 mt-1">{result.reportType.description}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
            <h4 className="text-yellow-800 font-semibold mb-2">تعليمات التحقق:</h4>
            <ul className="text-yellow-700 text-sm space-y-1">
              <li>• افتح ملفات PDF التي تم تنزيلها للتحقق من عرض النص العربي</li>
              <li>• تأكد من أن الحروف العربية تظهر بوضوح بدون تشوه أو مربعات</li>
              <li>• تحقق من أن المحاذاة من اليمين إلى اليسار تعمل بشكل صحيح</li>
              <li>• تأكد من أن الأرقام العربية تظهر بالشكل الصحيح</li>
              <li>• إذا ظهرت مشاكل، تحقق من حالة الخطوط أعلاه</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArabicFontTest;