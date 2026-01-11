import React, { useState, useEffect } from 'react';
import { print } from '@/printing';
import { createPDF } from '@/utils/pdfUtils';
import { generateArabicPdf, generateMixedPdf } from '../printing/pdf/autoPdf';

const ComprehensivePdfTest = () => {
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState(false);

  const runAllTests = async () => {
    setLoading(true);
    const results = {};

    // Test 1: Basic PDF generation with Arabic text
    try {
      const doc = await createPDF({ orientation: 'p', unit: 'pt', format: 'a4', lang: 'ar' });
      doc.setFontSize(16);
      doc.safeText('تقرير اختبار النظام', 36, 60);
      doc.setFontSize(12);
      doc.safeText('هذا نص عربي للاختبار: القيود اليومية والمبيعات', 36, 90);
      doc.safeText('رقم القيد: 12345', 36, 110);
      doc.safeText('المبلغ: ١٬٢٣٤٫٥٦ ريال سعودي', 36, 130);
      
      await new Promise(resolve => {
        doc.save('test-basic-arabic.pdf');
        setTimeout(resolve, 1000);
      });
      results.basicArabic = { success: true, message: 'تم إنشاء PDF أساسي بنجاح' };
    } catch (error) {
      results.basicArabic = { success: false, message: error.message };
    }

    // Test 2: Mixed Arabic and English content
    try {
      const doc = await createPDF({ orientation: 'p', unit: 'pt', format: 'a4', lang: 'ar' });
      doc.setFontSize(16);
      doc.safeText('Financial Report / التقرير المالي', 36, 60);
      doc.setFontSize(12);
      doc.safeText('Company: شركة الاختبار المحدودة', 36, 90);
      doc.safeText('Date: 2024-01-15 / التاريخ: ١٥-٠١-٢٠٢٤', 36, 110);
      doc.safeText('Total Amount: $1,500.00 / المبلغ الإجمالي: ١٬٥٠٠٫٠٠ $', 36, 130);
      
      await new Promise(resolve => {
        doc.save('test-mixed-content.pdf');
        setTimeout(resolve, 1000);
      });
      results.mixedContent = { success: true, message: 'تم إنشاء PDF مختلط بنجاح' };
    } catch (error) {
      results.mixedContent = { success: false, message: error.message };
    }

    // Test 3: Table with Arabic data
    try {
      const doc = await createPDF({ orientation: 'p', unit: 'pt', format: 'a4', lang: 'ar' });
      doc.setFontSize(16);
      doc.safeText('جدول القيود المحاسبية', 36, 60);
      
      // Table headers
      doc.setFontSize(12);
      doc.safeText('التاريخ', 36, 90);
      doc.safeText('الوصف', 150, 90);
      doc.safeText('المبلغ', 400, 90);
      
      // Table data
      const data = [
        { date: '2024-01-01', desc: 'قيد افتتاحي', amount: '١٠٠٠ ر.س' },
        { date: '2024-01-02', desc: 'مبيعات نقدية', amount: '٢٥٠٠ ر.س' },
        { date: '2024-01-03', desc: 'مصاريف إدارية', amount: '٥٠٠ ر.س' }
      ];
      
      let y = 110;
      data.forEach(row => {
        doc.safeText(row.date, 36, y);
        doc.safeText(row.desc, 150, y);
        doc.safeText(row.amount, 400, y);
        y += 20;
      });
      
      await new Promise(resolve => {
        doc.save('test-table-arabic.pdf');
        setTimeout(resolve, 1000);
      });
      results.tableArabic = { success: true, message: 'تم إنشاء جدول عربي بنجاح' };
    } catch (error) {
      results.tableArabic = { success: false, message: error.message };
    }

    // Test 4: New Arabic PDF generation system
    try {
      const blob = await generateArabicPdf({
        title: 'تقرير شامل',
        entries: [
          { description: 'اختبار النظام', amount: '1000 ر.س' },
          { description: 'قيود يومية', amount: '2000 ر.س' }
        ]
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'test-new-arabic-system.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      results.newArabicSystem = { success: true, message: 'تم إنشاء PDF بالنظام الجديد بنجاح' };
    } catch (error) {
      results.newArabicSystem = { success: false, message: error.message };
    }

    // Test 5: Mixed content with new system
    try {
      const blob = await generateMixedPdf({
        companyName: 'شركة الاختبار',
        reportTitle: 'Comprehensive Test Report',
        data: [
          { date: '2024-01-01', amount: '$1,000.00' },
          { date: '2024-01-02', amount: '$2,500.00' }
        ]
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'test-new-mixed-system.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      results.newMixedSystem = { success: true, message: 'تم إنشاء PDF مختلط بالنظام الجديد بنجاح' };
    } catch (error) {
      results.newMixedSystem = { success: false, message: error.message };
    }

    setTestResults(results);
    setLoading(false);
  };

  const checkFontAvailability = () => {
    const fonts = [
      { name: 'Amiri-Regular.ttf', path: '/fonts/Amiri-Regular.ttf' },
      { name: 'Cairo-Regular.ttf', path: '/fonts/Cairo-Regular.ttf' },
      { name: 'Cairo-Regular.woff2', path: '/fonts/Cairo-Regular.woff2' }
    ];
    
    return Promise.all(
      fonts.map(async (font) => {
        try {
          const response = await fetch(font.path, { method: 'HEAD' });
          return { ...font, available: response.ok };
        } catch {
          return { ...font, available: false };
        }
      })
    );
  };

  useEffect(() => {
    checkFontAvailability().then(fontStatus => {
      console.log('Font availability:', fontStatus);
    });
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
        اختبار شامل لطباعة PDF باللغة العربية
      </h2>
      
      <div className="mb-6">
        <button
          onClick={runAllTests}
          disabled={loading}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-lg font-semibold"
        >
          {loading ? 'جاري تشغيل الاختبارات...' : 'تشغيل جميع الاختبارات'}
        </button>
      </div>

      {Object.keys(testResults).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">نتائج الاختبارات:</h3>
          
          {Object.entries(testResults).map(([testName, result]) => (
            <div key={testName} className={`p-4 rounded-lg border ${
              result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              <h4 className="font-semibold mb-2">
                {testName === 'basicArabic' && 'الاختبار الأساسي للعربية'}
                {testName === 'mixedContent' && 'اختبار المحتوى المختلط'}
                {testName === 'tableArabic' && 'اختبار الجداول العربية'}
                {testName === 'newArabicSystem' && 'النظام الجديد للعربية'}
                {testName === 'newMixedSystem' && 'النظام الجديد المختلط'}
              </h4>
              <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                {result.message}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-yellow-50 p-4 rounded-lg">
        <h4 className="text-yellow-800 font-semibold mb-2">ملاحظات مهمة:</h4>
        <ul className="text-yellow-700 text-sm space-y-1">
          <li>• يجب أن تظهر جميع النصوص العربية بوضوح بدون مربعات</li>
          <li>• يجب أن يكون محاذاة النص العربي من اليمين إلى اليسار</li>
          <li>• الأرقام العربية يجب أن تظهر بالشكل الصحيح</li>
          <li>• إذا ظهرت مربعات بدلاً من النص، فهذا يعني وجود مشكلة في الخط</li>
          <li>• تحقق من الملفات التي تم تنزيلها للتأكد من جودة النص العربي</li>
        </ul>
      </div>

      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h4 className="text-blue-800 font-semibold mb-2">حالة الخطوط:</h4>
        <p className="text-blue-700 text-sm">
          يتم التحقق من توفر خط Amiri أولاً (المفضل)، ثم Cairo كخط احتياطي. يتم استخدام أول خط متاح.
        </p>
      </div>
    </div>
  );
};

export default ComprehensivePdfTest;