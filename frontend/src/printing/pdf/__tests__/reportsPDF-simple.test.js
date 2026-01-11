/**
 * Simple test to verify PDF generation functionality
 */

const { initPdfFonts } = require('../font-loader');
const { generateReportPDF } = require('../autoReports');

// Mock the API services
jest.mock('../../../services/api', () => ({
  __esModule: true,
  settings: {
    get: jest.fn((key) => {
      const mockData = {
        settings_company: {
          name_ar: 'شركة اختبار',
          name_en: 'Test Company',
          phone: '+966123456789',
          address: 'Test Address, Riyadh',
          vat_number: '1234567890'
        },
        settings_branding: {
          logo: null
        }
      };
      return Promise.resolve(mockData[key] || null);
    })
  },
  journal: {
    list: jest.fn(() => Promise.resolve({
      items: [
        {
          entry_number: '1',
          date: '2024-01-01',
          status: 'posted',
          description: 'Test entry',
          debit: 1000,
          credit: 1000
        }
      ]
    }))
  },
  accounts: {
    tree: jest.fn(() => Promise.resolve([]))
  }
}));

// Mock fetch for font loading
global.fetch = jest.fn(() => 
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
  })
);

// Mock pdfMake globally with proper structure
jest.mock('pdfmake/build/pdfmake', () => {
  const mockPdfMake = {
    vfs: {},
    fonts: {},
    createPdf: jest.fn(() => ({
      open: jest.fn(),
      download: jest.fn(),
      print: jest.fn()
    }))
  };
  return mockPdfMake;
});

describe('Reports PDF Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate journal report PDF without errors', async () => {
    await initPdfFonts();
    
    const pdfMake = require('pdfmake/build/pdfmake');
    
    await generateReportPDF({
      reportType: 'journal',
      lang: 'ar'
    });

    expect(pdfMake.createPdf).toHaveBeenCalled();
  });

  test('should handle font loading failures gracefully', async () => {
    // Reset fetch to fail font loading
    global.fetch.mockReset();
    global.fetch.mockRejectedValue(new Error('Font loading failed'));
    
    const pdfMake = require('pdfmake/build/pdfmake');
    
    await generateReportPDF({
      reportType: 'journal',
      lang: 'ar'
    });

    expect(pdfMake.createPdf).toHaveBeenCalled();
  });

  test('should handle API errors gracefully', async () => {
    await initPdfFonts();
    
    const { journal } = require('../../../services/api');
    journal.list.mockRejectedValueOnce(new Error('API Error'));
    
    const pdfMake = require('pdfmake/build/pdfmake');
    
    await generateReportPDF({
      reportType: 'journal',
      lang: 'ar'
    });

    expect(pdfMake.createPdf).toHaveBeenCalled();
  });
});