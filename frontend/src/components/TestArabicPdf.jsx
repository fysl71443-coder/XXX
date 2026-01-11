import React, { useState } from 'react';
import { generateArabicPdf, generateMixedPdf } from '../printing/pdf/autoPdf';

const TestArabicPdf = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const testArabicPdf = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const blob = await generateArabicPdf({
        title: 'تقرير القيود اليومية',
        date: new Date().toLocaleDateString('ar-SA'),
        entries: [
          { description: 'قيد افتتاحي', amount: '1000 ر.س' },
          { description: 'قيد ترحيل', amount: '500 ر.س' }
        ]
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'test-arabic-pdf.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(true);
    } catch (err) {
      console.error('Error generating Arabic PDF:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testMixedPdf = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const blob = await generateMixedPdf({
        companyName: 'شركة الاختبار',
        reportTitle: 'Financial Report',
        data: [
          { date: '2024-01-01', amount: '$1,000.00' },
          { date: '2024-01-02', amount: '$2,500.00' }
        ]
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'test-mixed-pdf.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(true);
    } catch (err) {
      console.error('Error generating mixed PDF:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        اختبار طباعة PDF باللغة العربية
      </h2>
      
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            اختبار PDF عربي كامل
          </h3>
          <p className="text-blue-600 mb-4">
            هذا الاختبار يقوم بإنشاء ملف PDF بالكامل باللغة العربية
          </p>
          <button
            onClick={testArabicPdf}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء PDF عربي'}
          </button>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            اختبار PDF مختلط (عربي وإنجليزي)
          </h3>
          <p className="text-green-600 mb-4">
            هذا الاختبار يقوم بإنشاء ملف PDF يحتوي على نصوص عربية وإنجليزية
          </p>
          <button
            onClick={testMixedPdf}
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء PDF مختلط'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <h4 className="text-red-800 font-semibold">خطأ في الإنشاء:</h4>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <h4 className="text-green-800 font-semibold">تم بنجاح!</h4>
            <p className="text-green-600">تم إنشاء ملف PDF بنجاح. تم تحميل الملف تلقائياً.</p>
          </div>
        )}

        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="text-yellow-800 font-semibold mb-2">ملاحظات مهمة:</h4>
          <ul className="text-yellow-700 text-sm space-y-1">
            <li>• تأكد من وجود ملف الخط Cairo-Regular.ttf في مجلد fonts</li>
            <li>• إذا ظهرت مربعات بدلاً من النص العربي، فهذا يعني أن الخط غير متاح</li>
            <li>• يجب أن يظهر النص العربي بشكل واضح وبدون مشاكل</li>
            <li>• اختبر الملفات التي تم تنزيلها للتأكد من جودة النص العربي</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TestArabicPdf;