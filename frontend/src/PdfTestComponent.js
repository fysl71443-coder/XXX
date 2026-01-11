import React, { useState } from 'react';
import { generateArabicPdf, generateMixedPdf } from './printing/pdf/autoPdf';

function PdfTestComponent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateArabicPdf = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const pdfBlob = await generateArabicPdf();
      
      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'arabic-report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMixedPdf = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const pdfBlob = await generateMixedPdf();
      
      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mixed-report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>PDF Arabic Font Test</h1>
      <p>Click the buttons below to test Arabic text rendering in PDFs:</p>
      
      <div style={{ margin: '20px 0' }}>
        <button 
          onClick={handleGenerateArabicPdf}
          disabled={loading}
          style={{ 
            marginRight: '10px', 
            padding: '10px 20px', 
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Generating...' : 'Generate Arabic PDF'}
        </button>
        
        <button 
          onClick={handleGenerateMixedPdf}
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            fontSize: '16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Generating...' : 'Generate Mixed PDF'}
        </button>
      </div>

      {error && (
        <div style={{ 
          color: 'red', 
          backgroundColor: '#f8d7da', 
          padding: '10px', 
          borderRadius: '4px',
          margin: '20px 0'
        }}>
          Error: {error}
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <h3>Expected Results:</h3>
        <ul>
          <li><strong>Arabic PDF:</strong> Should display Arabic text correctly without boxes or garbled characters</li>
          <li><strong>Mixed PDF:</strong> Should display both Arabic and English text properly aligned</li>
          <li>Both PDFs should use the embedded Cairo TTF font</li>
        </ul>
        
        <h4>Arabic Text Samples:</h4>
        <div style={{ textAlign: 'right', fontSize: '18px', margin: '10px 0' }}>
          <div>تقرير القيود اليومية</div>
          <div>التاريخ: ٢٠٢٤-٠١-٠١</div>
          <div>المبلغ: ١٬٠٠٠٫٠٠ $</div>
        </div>
      </div>
    </div>
  );
}

export default PdfTestComponent;