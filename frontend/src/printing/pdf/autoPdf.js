import pdfMake from 'pdfmake/build/pdfmake';
import { initPdfFonts } from './font-loader';

// Initialize PDF fonts (call this once when your app starts)
export async function initializePdfFonts() {
  await initPdfFonts();
}

/**
 * Generate PDF with proper Arabic font support
 * This function creates a PDF document with embedded TTF fonts for Arabic text
 */
export async function generateArabicPdf(data) {
  try {
    // Ensure fonts are initialized
    await initializePdfFonts();

    const docDefinition = {
      // Set default font to Cairo for Arabic support
      defaultStyle: {
        font: (pdfMake.vfs && pdfMake.vfs['Amiri-Regular.ttf']) ? 'Amiri' : 'Cairo',
        fontSize: 12,
      },
      content: [
        {
          text: 'تقرير القيود اليومية',
          alignment: 'right',
          rtl: true,
          fontSize: 16,
          bold: true,
          margin: [0, 0, 0, 20]
        },
        {
          text: 'Journal Entries Report',
          alignment: 'left',
          fontSize: 14,
          margin: [0, 0, 0, 10]
        },
        {
          text: 'تفاصيل القيود المحاسبية',
          alignment: 'right',
          rtl: true,
          fontSize: 12,
          margin: [0, 10, 0, 10]
        }
      ],
      // Set page direction to RTL for Arabic
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
          font: 'Cairo',
          alignment: 'right',
          rtl: true
        }
      }
    };

    // Generate PDF
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    
    return new Promise((resolve, reject) => {
      pdfDocGenerator.getBlob((blob) => {
        resolve(blob);
      }, (error) => {
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

/**
 * Generate PDF with mixed Arabic and English content
 */
export async function generateMixedPdf(data) {
  try {
    await initializePdfFonts();

    const docDefinition = {
      defaultStyle: {
        font: (pdfMake.vfs && pdfMake.vfs['Amiri-Regular.ttf']) ? 'Amiri' : 'Cairo',
        fontSize: 11,
      },
      content: [
        {
          columns: [
            {
              width: '*',
              text: 'Company Name',
              alignment: 'left'
            },
            {
              width: '*',
              text: 'اسم الشركة',
              alignment: 'right',
              rtl: true
            }
          ],
          margin: [0, 0, 0, 20]
        },
        {
          text: 'Financial Report / التقرير المالي',
          alignment: 'center',
          fontSize: 16,
          bold: true,
          margin: [0, 0, 0, 20]
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: 'Date', alignment: 'center' },
                { text: 'التاريخ', alignment: 'center' },
                { text: 'Amount', alignment: 'center' },
                { text: 'المبلغ', alignment: 'center' }
              ],
              [
                { text: '2024-01-01', alignment: 'center' },
                { text: '٢٠٢٤-٠١-٠١', alignment: 'center' },
                { text: '$1,000.00', alignment: 'center' },
                { text: '١٬٠٠٠٫٠٠ $', alignment: 'center' }
              ]
            ]
          },
          margin: [0, 10, 0, 10]
        }
      ],
      defaultStyle: {
        font: (pdfMake.vfs && pdfMake.vfs['Amiri-Regular.ttf']) ? 'Amiri' : 'Cairo'
      }
    };

    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    
    return new Promise((resolve, reject) => {
      pdfDocGenerator.getBlob((blob) => {
        resolve(blob);
      }, (error) => {
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('Error generating mixed PDF:', error);
    throw error;
  }
}

// Export for use in other modules
export { pdfMake };