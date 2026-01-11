import React from 'react';
import { generateArabicPdf } from '../printing/pdf/autoPdf';

const QuickArabicTest = () => {
  const testArabicFont = async () => {
    try {
      const data = {
        title: 'اختبار سريع للخط العربي',
        content: 'هذا نص عربي للاختبار: القيود اليومية والمبيعات والمشتريات',
        date: '١٥/١٢/٢٠٢٤',
        amount: '١٠٠٠ ريال سعودي'
      };

      const blob = await generateArabicPdf(data);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'arabic-font-test.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert('تم إنشاء ملف PDF بنجاح! تحقق من التنزيلات.');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('فشل إنشاء PDF: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>اختبار الخط العربي</h1>
      <p>اضغط على الزر أدناه لاختبار إنشاء PDF باللغة العربية</p>
      <button 
        onClick={testArabicFont}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        اختبار إنشاء PDF عربي
      </button>
    </div>
  );
};

export default QuickArabicTest;