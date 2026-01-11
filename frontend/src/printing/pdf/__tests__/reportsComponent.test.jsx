/**
 * Test suite for Reports component PDF functionality
 * Tests UI integration, button clicks, and error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Reports from '../../pages/Reports';

// Mock the PDF generation functions
jest.mock('../../printing/pdf/autoReports', () => ({
  __esModule: true,
  generateReportPDF: jest.fn()
}));

// Mock the API services
jest.mock('../../services/api', () => ({
  __esModule: true,
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
    })),
    expensesByBranch: jest.fn(() => Promise.resolve({
      items: [
        { branch: 'Main Branch', total: 15000 },
        { branch: 'Branch 1', total: 10000 }
      ],
      total: 25000
    }))
  },
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
  }
}));

// Mock Auth context
jest.mock('../../context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({
    can: jest.fn((permission) => {
      const permissions = {
        'reports:view': true,
        'reports:export': true,
        'reports:print': true
      };
      return permissions[permission] || false;
    })
  })
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  __esModule: true,
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

describe('Reports Component PDF Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage
    localStorage.clear();
  });

  test('should render print buttons for accounting reports', async () => {
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('مركز التقارير')).toBeInTheDocument();
    });

    // Check for print buttons
    const printButtons = screen.getAllByRole('button', { name: /print/i });
    expect(printButtons.length).toBeGreaterThan(0);
  });

  test('should handle trial balance PDF generation', async () => {
    const { generateReportPDF } = require('../../printing/pdf/autoReports');
    
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('مركز التقارير')).toBeInTheDocument();
    });

    // Find the trial balance print button
    const trialBalanceSection = screen.getByText('ميزان المراجعة').closest('.bg-white');
    const printButton = trialBalanceSection.querySelector('button[title*="print"]');
    
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(generateReportPDF).toHaveBeenCalledWith({
        reportType: 'trialBalance',
        lang: 'ar',
        fromDate: null,
        toDate: null
      });
    });
  });

  test('should handle income statement PDF generation', async () => {
    const { generateReportPDF } = require('../../printing/pdf/autoReports');
    
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('مركز التقارير')).toBeInTheDocument();
    });

    // Find the income statement print button
    const incomeStatementSection = screen.getByText('قائمة الدخل').closest('.bg-white');
    const printButton = incomeStatementSection.querySelector('button[title*="print"]');
    
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(generateReportPDF).toHaveBeenCalledWith({
        reportType: 'income',
        lang: 'ar',
        fromDate: null,
        toDate: null
      });
    });
  });

  test('should handle balance sheet PDF generation', async () => {
    const { generateReportPDF } = require('../../printing/pdf/autoReports');
    
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('مركز التقارير')).toBeInTheDocument();
    });

    // Find the balance sheet print button
    const balanceSheetSection = screen.getByText('المركز المالي').closest('.bg-white');
    const printButton = balanceSheetSection.querySelector('button[title*="print"]');
    
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(generateReportPDF).toHaveBeenCalledWith({
        reportType: 'balance',
        lang: 'ar',
        fromDate: null,
        toDate: null
      });
    });
  });

  test('should handle PDF generation errors gracefully', async () => {
    const { generateReportPDF } = require('../../printing/pdf/autoReports');
    generateReportPDF.mockRejectedValueOnce(new Error('PDF generation failed'));
    
    // Mock console.error to avoid test output pollution
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('مركز التقارير')).toBeInTheDocument();
    });

    // Find and click a print button
    const trialBalanceSection = screen.getByText('ميزان المراجعة').closest('.bg-white');
    const printButton = trialBalanceSection.querySelector('button[title*="print"]');
    
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(generateReportPDF).toHaveBeenCalled();
    });

    // Check if error message appears (you might need to add error display logic to your component)
    // For now, we just verify that the function was called and didn't crash the component

    consoleSpy.mockRestore();
  });

  test('should handle period filter in PDF generation', async () => {
    const { generateReportPDF } = require('../../printing/pdf/autoReports');
    
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('مركز التقارير')).toBeInTheDocument();
    });

    // Change period filter
    const periodSelect = screen.getByLabelText('الفترة');
    fireEvent.change(periodSelect, { target: { value: '2024-01' } });

    // Find and click a print button
    const trialBalanceSection = screen.getByText('ميزان المراجعة').closest('.bg-white');
    const printButton = trialBalanceSection.querySelector('button[title*="print"]');
    
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(generateReportPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          fromDate: '2024-01-01',
          toDate: '2024-01-31'
        })
      );
    });
  });

  test('should handle language switching in PDF generation', async () => {
    const { generateReportPDF } = require('../../printing/pdf/autoReports');
    
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('مركز التقارير')).toBeInTheDocument();
    });

    // Switch to English
    localStorage.setItem('lang', 'en');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'lang',
      newValue: 'en'
    }));

    // Wait for language change
    await waitFor(() => {
      expect(screen.getByText('Reports Hub')).toBeInTheDocument();
    });

    // Find and click a print button
    const trialBalanceSection = screen.getByText('Trial Balance').closest('.bg-white');
    const printButton = trialBalanceSection.querySelector('button[title*="print"]');
    
    fireEvent.click(printButton);

    await waitFor(() => {
      expect(generateReportPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          lang: 'en'
        })
      );
    });
  });

  test('should handle permission restrictions', async () => {
    // Mock restricted permissions
    jest.mock('../../context/AuthContext', () => ({
      __esModule: true,
      useAuth: () => ({
        can: jest.fn((permission) => {
          const permissions = {
            'reports:view': true,
            'reports:export': true,
            'reports:print': false // Print permission denied
          };
          return permissions[permission] || false;
        })
      })
    }));

    const { generateReportPDF } = require('../../printing/pdf/autoReports');
    
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('مركز التقارير')).toBeInTheDocument();
    });

    // Find the trial balance print button (should be disabled)
    const trialBalanceSection = screen.getByText('ميزان المراجعة').closest('.bg-white');
    const printButton = trialBalanceSection.querySelector('button[title*="print"]');
    
    // Should be disabled
    expect(printButton).toBeDisabled();
    
    // Click should not trigger PDF generation
    fireEvent.click(printButton);
    
    // Wait a bit and verify PDF generation was NOT called
    await waitFor(() => {
      expect(generateReportPDF).not.toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  test('should handle cross-module reports PDF generation', async () => {
    const { generateReportPDF } = require('../../printing/pdf/autoReports');
    
    render(
      <BrowserRouter>
        <Reports />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('مركز التقارير')).toBeInTheDocument();
    });

    // Find a cross-module report print button
    const crossModuleSection = screen.getByText('المبيعات مقابل المصروفات').closest('.bg-white');
    const printButton = crossModuleSection.querySelector('button[title*="print"]');
    
    fireEvent.click(printButton);

    // For cross-module reports, it should first load the data and then generate PDF
    await waitFor(() => {
      expect(generateReportPDF).toHaveBeenCalled();
    });
  });
});