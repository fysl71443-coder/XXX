/**
 * Test for PDF Engine - the definitive Arabic PDF solution
 * Tests the embedded Base64 font approach with no fetch dependencies
 */

// Mock pdfMake before importing our engine
jest.mock('pdfmake/build/pdfmake', () => {
  const mockPdfMake = {
    vfs: {},
    fonts: {},
    createPdf: jest.fn(() => ({
      open: jest.fn(),
      download: jest.fn(),
      print: jest.fn(),
      getBuffer: jest.fn()
    }))
  };
  return mockPdfMake;
});

// Mock the Base64 font data
jest.mock('../pdfFonts', () => ({
  amiriBase64: 'mocked-amiri-base64-data'
}));

describe('PDF Engine - Definitive Arabic PDF Solution', () => {
  let pdfEngine;
  let mockPdfMake;

  beforeEach(() => {
    // Clear module cache to ensure fresh import
    jest.clearAllMocks();
    jest.resetModules();
    
    // Get fresh mock instance
    mockPdfMake = require('pdfmake/build/pdfmake');
    
    // Import the engine after mocks are set up
    pdfEngine = require('../pdfEngine');
  });

  describe('Engine Initialization', () => {
    test('should initialize PDF engine with Amiri font', () => {
      // Verify VFS is set up correctly
      expect(mockPdfMake.vfs['Amiri-Regular.ttf']).toBe('mocked-amiri-base64-data');
      
      // Verify font family is defined
      expect(mockPdfMake.fonts.Amiri).toBeDefined();
      expect(mockPdfMake.fonts.Amiri.normal).toBe('Amiri-Regular.ttf');
      expect(mockPdfMake.fonts.Amiri.bold).toBe('Amiri-Regular.ttf');
      expect(mockPdfMake.fonts.Amiri.italics).toBe('Amiri-Regular.ttf');
      expect(mockPdfMake.fonts.Amiri.bolditalics).toBe('Amiri-Regular.ttf');
    });

    test('should clear previous VFS entries', () => {
      // Reset modules completely
      jest.resetModules();
      
      // Setup fresh mock with existing data
      const freshMockPdfMake = require('pdfmake/build/pdfmake');
      freshMockPdfMake.vfs = { 'old-font.ttf': 'old-font-data' };
      freshMockPdfMake.fonts = {};
      
      // Re-import engine
      const freshPdfEngine = require('../pdfEngine');
      
      // Should only have Amiri font
      expect(Object.keys(freshMockPdfMake.vfs)).toEqual(['Amiri-Regular.ttf']);
    });

    test('should initialize successfully', () => {
      expect(() => {
        pdfEngine.initPdfEngine();
      }).not.toThrow();
    });

    test('should provide engine status', () => {
      const status = pdfEngine.getPdfEngineStatus();
      
      expect(status.vfsReady).toBe(true);
      expect(status.fontsReady).toBe(true);
      expect(status.vfsKeys).toContain('Amiri-Regular.ttf');
      expect(status.fontFamilies).toContain('Amiri');
    });
  });

  describe('PDF Creation', () => {
    test('should create PDF with Amiri font as default', () => {
      const mockDocDefinition = {
        content: [{ text: 'Test content' }]
      };

      const pdfInstance = pdfEngine.createPdf(mockDocDefinition);

      // Verify createPdf was called with correct parameters
      expect(mockPdfMake.createPdf).toHaveBeenCalledWith({
        content: [{ text: 'Test content' }],
        defaultStyle: {
          font: 'Amiri',
          fontSize: 10
        }
      });

      // Verify PDF instance was returned
      expect(pdfInstance).toBeDefined();
      expect(mockPdfMake.createPdf).toHaveBeenCalled();
    });

    test('should allow overriding default style', () => {
      const mockDocDefinition = {
        content: [{ text: 'Test content' }],
        defaultStyle: {
          fontSize: 12,
          color: 'red'
        }
      };

      pdfEngine.createPdf(mockDocDefinition);

      expect(mockPdfMake.createPdf).toHaveBeenCalledWith({
        content: [{ text: 'Test content' }],
        defaultStyle: {
          font: 'Amiri',
          fontSize: 12,
          color: 'red'
        }
      });
    });

    test('should handle Arabic content', () => {
      const arabicDocDefinition = {
        content: [{ text: 'تقرير القيود اليومية' }]
      };

      const pdfInstance = pdfEngine.createPdf(arabicDocDefinition);

      expect(mockPdfMake.createPdf).toHaveBeenCalledWith({
        content: [{ text: 'تقرير القيود اليومية' }],
        defaultStyle: {
          font: 'Amiri',
          fontSize: 10
        }
      });

      expect(pdfInstance).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing font gracefully', () => {
      // Simulate missing font
      mockPdfMake.vfs = {};
      
      expect(() => {
        pdfEngine.initPdfEngine();
      }).toThrow('PDF Engine initialization failed - Amiri font missing');
    });

    test('should handle missing font family gracefully', () => {
      // Simulate missing font family - first ensure VFS has the font
      mockPdfMake.vfs['Amiri-Regular.ttf'] = 'mocked-amiri-base64-data';
      mockPdfMake.fonts = {};
      
      expect(() => {
        pdfEngine.initPdfEngine();
      }).toThrow('PDF Engine initialization failed - Amiri font family missing');
    });
  });

  describe('Production Readiness', () => {
    test('should not depend on fetch or external resources', () => {
      // This test verifies that our engine doesn't use fetch
      // The fact that it works with mocked modules proves it's not dependent on external resources
      const originalFetch = global.fetch;
      delete global.fetch;
      
      // Should work without fetch
      expect(() => {
        pdfEngine.initPdfEngine();
      }).not.toThrow();
      
      // Restore fetch
      global.fetch = originalFetch;
    });

    test('should work with Base64 font data only', () => {
      // The engine should initialize successfully with just Base64 data
      // Ensure VFS is properly set up first
      mockPdfMake.vfs['Amiri-Regular.ttf'] = 'mocked-amiri-base64-data';
      mockPdfMake.fonts.Amiri = {
        normal: 'Amiri-Regular.ttf',
        bold: 'Amiri-Regular.ttf',
        italics: 'Amiri-Regular.ttf',
        bolditalics: 'Amiri-Regular.ttf'
      };
      
      expect(() => {
        pdfEngine.initPdfEngine();
      }).not.toThrow();
    });

    test('should provide consistent font configuration', () => {
      const status = pdfEngine.getPdfEngineStatus();
      
      // Should have exactly one font
      expect(status.vfsKeys).toHaveLength(1);
      expect(status.vfsKeys[0]).toBe('Amiri-Regular.ttf');
      
      // Should have exactly one font family
      expect(status.fontFamilies).toHaveLength(1);
      expect(status.fontFamilies[0]).toBe('Amiri');
    });
  });
});