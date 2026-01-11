/**
 * Test suite for font-loader module
 * Tests font loading, fallback mechanisms, and error handling
 */

import { initPdfFonts } from '../font-loader';
import pdfMake from 'pdfmake/build/pdfmake';

// Mock pdfmake
jest.mock('pdfmake/build/pdfmake', () => ({
  vfs: {},
  fonts: {}
}));

// Mock the pdfFonts
jest.mock('pdfmake/build/vfs_fonts', () => ({
  vfs_fonts: {}
}));

// Mock the fallback font
jest.mock('../pdfFonts', () => ({
  cairoBase64: 'mocked-base64-font-data'
}));

describe('Font Loader Module', () => {
  let originalFetch;

  beforeEach(() => {
    // Reset pdfMake mocks
    pdfMake.vfs = {};
    pdfMake.fonts = {};
    
    // Mock fetch
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('Successful Font Loading', () => {
    test('should load both Cairo and Amiri fonts successfully', async () => {
      // Mock successful responses for both fonts
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        });

      await initPdfFonts();

      // Verify fonts were loaded
      expect(global.fetch).toHaveBeenCalledWith('/fonts/Cairo-Regular.ttf');
      expect(global.fetch).toHaveBeenCalledWith('/fonts/Amiri-Regular.ttf');
      
      // Verify fonts are in VFS
      expect(pdfMake.vfs['Cairo-Regular.ttf']).toBeDefined();
      expect(pdfMake.vfs['Amiri-Regular.ttf']).toBeDefined();
      
      // Verify fonts are registered
      expect(pdfMake.fonts.Cairo).toBeDefined();
      expect(pdfMake.fonts.Amiri).toBeDefined();
    });

    test('should handle Cairo WOFF2 format fallback', async () => {
      // Mock TTF failure but WOFF2 success
      global.fetch
        .mockRejectedValueOnce(new Error('TTF not found'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        });

      await initPdfFonts();

      // Should try both TTF and WOFF2 for Cairo
      expect(global.fetch).toHaveBeenCalledWith('/fonts/Cairo-Regular.ttf');
      expect(global.fetch).toHaveBeenCalledWith('/fonts/Cairo-Regular.woff2');
      expect(global.fetch).toHaveBeenCalledWith('/fonts/Amiri-Regular.ttf');
    });
  });

  describe('Font Loading Failures', () => {
    test('should use fallback when Cairo font fails completely', async () => {
      // Mock complete failure for Cairo
      global.fetch
        .mockRejectedValueOnce(new Error('TTF not found'))
        .mockRejectedValueOnce(new Error('WOFF2 not found'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await initPdfFonts();

      // Should have fallback font data
      expect(pdfMake.vfs['fallback-arabic.ttf']).toBe('mocked-base64-font-data');
      expect(pdfMake.fonts.Cairo).toBeDefined();
      
      // Should still have Amiri
      expect(pdfMake.vfs['Amiri-Regular.ttf']).toBeDefined();
      expect(pdfMake.fonts.Amiri).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('should handle Amiri font failure gracefully', async () => {
      // Mock Amiri failure but Cairo success
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        })
        .mockRejectedValueOnce(new Error('Amiri not found'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await initPdfFonts();

      // Should have Cairo
      expect(pdfMake.vfs['Cairo-Regular.ttf']).toBeDefined();
      expect(pdfMake.fonts.Cairo).toBeDefined();
      
      // Should not have Amiri font registration
      expect(pdfMake.fonts.Amiri).toBeUndefined();

      consoleSpy.mockRestore();
    });

    test('should handle complete font loading failure', async () => {
      // Mock complete failure for all fonts
      global.fetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await initPdfFonts();

      // Should have fallback font
      expect(pdfMake.vfs['fallback-arabic.ttf']).toBe('mocked-base64-font-data');
      expect(pdfMake.fonts.Cairo).toBeDefined();
      
      // Should not crash
      expect(pdfMake.fonts).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe('Font Registration', () => {
    test('should register fonts with correct structure', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });

      await initPdfFonts();

      // Check Cairo font structure
      expect(pdfMake.fonts.Cairo).toEqual({
        normal: 'Cairo-Regular.ttf',
        bold: 'Cairo-Regular.ttf',
        italics: 'Cairo-Regular.ttf',
        bolditalics: 'Cairo-Regular.ttf'
      });

      // Check Amiri font structure
      expect(pdfMake.fonts.Amiri).toEqual({
        normal: 'Amiri-Regular.ttf',
        bold: 'Amiri-Regular.ttf',
        italics: 'Amiri-Regular.ttf',
        bolditalics: 'Amiri-Regular.ttf'
      });
    });

    test('should handle font registration when Amiri fails', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        })
        .mockRejectedValueOnce(new Error('Amiri not found'));

      await initPdfFonts();

      // Should have Cairo
      expect(pdfMake.fonts.Cairo).toBeDefined();
      
      // Should not have Amiri
      expect(pdfMake.fonts.Amiri).toBeUndefined();
    });
  });

  describe('VFS Management', () => {
    test('should preserve existing VFS entries', async () => {
      // Pre-populate VFS
      pdfMake.vfs['existing-font.ttf'] = 'existing-data';

      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });

      await initPdfFonts();

      // Should preserve existing entry
      expect(pdfMake.vfs['existing-font.ttf']).toBe('existing-data');
      
      // Should add new entries
      expect(pdfMake.vfs['Cairo-Regular.ttf']).toBeDefined();
      expect(pdfMake.vfs['Amiri-Regular.ttf']).toBeDefined();
    });

    test('should handle VFS initialization', async () => {
      // Start with undefined VFS
      pdfMake.vfs = undefined;

      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      });

      await initPdfFonts();

      // Should initialize VFS
      expect(pdfMake.vfs).toBeDefined();
      expect(typeof pdfMake.vfs).toBe('object');
    });
  });

  describe('Error Handling', () => {
    test('should handle fetch network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      await expect(initPdfFonts()).resolves.not.toThrow();

      consoleSpy.mockRestore();
    });

    test('should handle invalid response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      await expect(initPdfFonts()).resolves.not.toThrow();

      consoleSpy.mockRestore();
    });

    test('should handle arrayBuffer errors', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.reject(new Error('ArrayBuffer error'))
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      await expect(initPdfFonts()).resolves.not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('Console Logging', () => {
    test('should log warnings for font loading failures', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await initPdfFonts();

      // Should have logged warnings
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty font data', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) // Empty buffer
      });

      await initPdfFonts();

      // Should still register fonts (even with empty data)
      expect(pdfMake.fonts.Cairo).toBeDefined();
      expect(pdfMake.fonts.Amiri).toBeDefined();
    });

    test('should handle large font files', async () => {
      // Mock large font file
      const largeBuffer = new ArrayBuffer(1024 * 1024); // 1MB
      
      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(largeBuffer)
      });

      // Should handle large files without issues
      await expect(initPdfFonts()).resolves.not.toThrow();
    });

    test('should handle special characters in font data', async () => {
      // Create buffer with special characters
      const buffer = new ArrayBuffer(10);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < view.length; i++) {
        view[i] = i + 128; // High byte values
      }

      global.fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer)
      });

      await initPdfFonts();

      // Should handle special characters without issues
      expect(pdfMake.fonts.Cairo).toBeDefined();
      expect(pdfMake.fonts.Amiri).toBeDefined();
    });
  });
});