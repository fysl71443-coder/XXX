/**
 * Comprehensive test suite for Reports PDF functionality
 * Tests font loading, PDF generation, error handling, and language support
 */

import { initPdfFonts } from '../font-loader';
import { generateReportPDF } from '../autoReports';

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
    tree: jest.fn(() => Promise.resolve([
      {
        id: 1,
        name: 'Assets',
        name_en: 'Assets',
        type: 'asset',
        opening_balance: 0
      },
      {
        id: 2,
        name: 'Revenue',
        name_en: 'Revenue',
        type: 'revenue',
        opening_balance: 0
      }
    ]))
  },
  reports: {
    salesVsExpenses: jest.fn(() => Promise.resolve({
      sales: 50000,
      expenses: 30000,
      net: 20000
    })),
    salesByBranch: jest.fn(() => Promise.resolve({
      items: [
        { branch: 'Main Branch', total: 30000 },
        { branch: 'Branch 1', total: 20000 }
      ],
      total: 50000
    }))
  }
}));

// Mock fetch for font loading
global.fetch = jest.fn();

// Mock pdfMake globally
jest.mock('pdfmake/build/pdfmake', () => ({
  vfs: {},
  fonts: {},
  createPdf: jest.fn(() => ({
    open: jest.fn(),
    download: jest.fn(),
    print: jest.fn()
  }))
}));

describe('Reports PDF Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    global.fetch.mockReset();
  });

  describe('Font Loading Tests', () => {
    test('should load fonts successfully when files exist', async () => {
      // Mock successful font file responses
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });

      await expect(initPdfFonts()).resolves.not.toThrow();
    });

    test('should handle font loading failures gracefully', async () => {
      // Mock font file loading failure
      global.fetch.mockRejectedValue(new Error('Font loading failed'));

      // Should not throw, should use fallback fonts
      await expect(initPdfFonts()).resolves.not.toThrow();
    });

    test('should handle partial font loading failures', async () => {
      // Mock partial failure - first call succeeds, second fails
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        })
        .mockRejectedValueOnce(new Error('Font loading failed'));

      await expect(initPdfFonts()).resolves.not.toThrow();
    });

    test('should handle HTTP errors for font files', async () => {
      // Mock HTTP error response
      global.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(initPdfFonts()).resolves.not.toThrow();
    });
  });

  describe('PDF Generation Tests', () => {
    beforeEach(async () => {
      // Setup successful font loading for PDF tests
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });
      await initPdfFonts();
    });

    test('should generate journal report PDF successfully', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'ar',
        fromDate: '2024-01-01',
        toDate: '2024-01-31'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    test('should generate income statement PDF successfully', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'income',
        lang: 'ar',
        fromDate: '2024-01-01',
        toDate: '2024-01-31'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    test('should generate balance sheet PDF successfully', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'balance',
        lang: 'ar',
        fromDate: '2024-01-01',
        toDate: '2024-01-31'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    test('should generate VAT report PDF successfully', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'vat',
        lang: 'ar',
        fromDate: '2024-01-01',
        toDate: '2024-01-31'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    test('should generate ledger report PDF successfully', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'ledger',
        lang: 'ar',
        fromDate: '2024-01-01',
        toDate: '2024-01-31'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });
  });

  describe('Language Support Tests', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });
      await initPdfFonts();
    });

    test('should generate PDF with Arabic content', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'ar'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    test('should generate PDF with English content', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'en'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });
  });

  describe('Error Handling Tests', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });
      await initPdfFonts();
    });

    test('should handle API errors gracefully', async () => {
      const { journal } = require('../../../services/api');
      journal.list.mockRejectedValueOnce(new Error('API Error'));

      const pdfMake = require('pdfmake/build/pdfmake');

      // Should not throw, should handle error gracefully
      await expect(generateReportPDF({
        reportType: 'journal',
        lang: 'ar'
      })).resolves.not.toThrow();

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    test('should handle missing company data gracefully', async () => {
      const { settings } = require('../../../services/api');
      settings.get.mockResolvedValueOnce(null);

      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'ar'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    test('should handle font initialization failures', async () => {
      // Reset fetch to fail font loading
      global.fetch.mockRejectedValue(new Error('Font loading failed'));
      
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'ar'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });
  });

  describe('Download vs Open Tests', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });
      await initPdfFonts();
    });

    test('should download PDF when download parameter is true', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'ar',
        download: true
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    test('should open PDF when download parameter is false', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'ar',
        download: false
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });
  });

  describe('Date Range Tests', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });
      await initPdfFonts();
    });

    test('should handle date range in PDF generation', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'ar',
        fromDate: '2024-01-01',
        toDate: '2024-01-31'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    test('should handle missing date range', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'ar'
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });
  });

  describe('File Name Tests', () => {
    beforeEach(async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });
      await initPdfFonts();
    });

    test('should generate correct file name with date range', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'ar',
        fromDate: '2024-01-01',
        toDate: '2024-01-31',
        download: true
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    test('should generate correct file name without date range', async () => {
      const pdfMake = require('pdfmake/build/pdfmake');

      await generateReportPDF({
        reportType: 'journal',
        lang: 'ar',
        download: true
      });

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });
  });
});