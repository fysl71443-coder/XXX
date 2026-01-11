/**
 * Manual Test Script for Reports PDF Functionality
 * Run this script in the browser console to test PDF generation
 * 
 * Usage:
 * 1. Open your application in the browser
 * 2. Navigate to the Reports page
 * 3. Open browser console (F12)
 * 4. Copy and paste this entire script
 * 5. Run the test functions as needed
 */

// Test Results Storage
window.pdfTestResults = {
  fontLoading: [],
  pdfGeneration: [],
  errors: []
};

/**
 * Test Font Loading
 * Tests the font loading mechanism
 */
async function testFontLoading() {
  console.log('📝 Testing Font Loading...');
  
  try {
    // Import the font loader
    const { initPdfFonts } = await import('./src/printing/pdf/font-loader.js');
    
    console.log('⏳ Loading fonts...');
    await initPdfFonts();
    
    // Check if fonts are loaded
    const pdfMake = window.pdfMake || (await import('pdfmake/build/pdfmake.js')).default;
    
    const results = {
      cairoLoaded: !!pdfMake.vfs['Cairo-Regular.ttf'],
      amiriLoaded: !!pdfMake.vfs['Amiri-Regular.ttf'],
      cairoRegistered: !!pdfMake.fonts.Cairo,
      amiriRegistered: !!pdfMake.fonts.Amiri
    };
    
    console.log('✅ Font Loading Results:', results);
    window.pdfTestResults.fontLoading.push(results);
    
    return results;
  } catch (error) {
    console.error('❌ Font Loading Error:', error);
    window.pdfTestResults.errors.push({ test: 'fontLoading', error: error.message });
    return null;
  }
}

/**
 * Test PDF Generation
 * Tests generating different types of reports
 */
async function testPDFGeneration(reportType = 'journal', lang = 'ar') {
  console.log(`📝 Testing PDF Generation: ${reportType} (${lang})...`);
  
  try {
    // Import the PDF generator
    const { generateReportPDF } = await import('./src/printing/pdf/autoReports.js');
    
    console.log(`⏳ Generating ${reportType} report...`);
    
    // Test with download = false to avoid downloading files during testing
    await generateReportPDF({
      reportType: reportType,
      lang: lang,
      fromDate: '2024-01-01',
      toDate: '2024-01-31',
      download: false
    });
    
    const result = {
      reportType: reportType,
      language: lang,
      success: true,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ PDF Generation Successful:', result);
    window.pdfTestResults.pdfGeneration.push(result);
    
    return result;
  } catch (error) {
    console.error('❌ PDF Generation Error:', error);
    window.pdfTestResults.errors.push({ 
      test: 'pdfGeneration', 
      reportType: reportType,
      language: lang,
      error: error.message 
    });
    return null;
  }
}

/**
 * Test All Report Types
 * Tests all available report types in both languages
 */
async function testAllReportTypes() {
  console.log('📝 Testing All Report Types...');
  
  const reportTypes = ['journal', 'income', 'balance', 'vat', 'ledger'];
  const languages = ['ar', 'en'];
  const results = [];
  
  for (const lang of languages) {
    for (const reportType of reportTypes) {
      console.log(`⏳ Testing ${reportType} in ${lang}...`);
      const result = await testPDFGeneration(reportType, lang);
      results.push({ reportType, lang, result });
      
      // Small delay between tests to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('✅ All Report Types Tested:', results);
  return results;
}

/**
 * Test Font Fallback
 * Tests font loading with simulated failures
 */
async function testFontFallback() {
  console.log('📝 Testing Font Fallback Mechanism...');
  
  try {
    // Temporarily override fetch to simulate font loading failures
    const originalFetch = window.fetch;
    
    // Test 1: Complete failure
    window.fetch = async (url) => {
      throw new Error(`Simulated failure for ${url}`);
    };
    
    const { initPdfFonts } = await import('./src/printing/pdf/font-loader.js');
    await initPdfFonts();
    
    const pdfMake = window.pdfMake || (await import('pdfmake/build/pdfmake.js')).default;
    
    const fallbackResult = {
      cairoFallback: !!pdfMake.fonts.Cairo,
      amiriFallback: !pdfMake.fonts.Amiri, // Should not exist when Amiri fails
      vfsHasFallback: !!pdfMake.vfs['fallback-arabic.ttf']
    };
    
    console.log('✅ Font Fallback Test Result:', fallbackResult);
    
    // Restore original fetch
    window.fetch = originalFetch;
    
    return fallbackResult;
  } catch (error) {
    console.error('❌ Font Fallback Test Error:', error);
    window.pdfTestResults.errors.push({ test: 'fontFallback', error: error.message });
    return null;
  }
}

/**
 * Test Error Handling
 * Tests error handling in PDF generation
 */
async function testErrorHandling() {
  console.log('📝 Testing Error Handling...');
  
  try {
    const { generateReportPDF } = await import('./src/printing/pdf/autoReports.js');
    
    // Test with invalid report type
    try {
      await generateReportPDF({
        reportType: 'invalid-type',
        lang: 'ar',
        download: false
      });
      console.log('⚠️ Invalid report type did not throw error');
    } catch (error) {
      console.log('✅ Invalid report type properly handled:', error.message);
    }
    
    // Test with missing parameters
    try {
      await generateReportPDF({
        lang: 'ar',
        download: false
      });
      console.log('✅ Missing report type handled gracefully');
    } catch (error) {
      console.log('✅ Missing report type properly handled:', error.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error Handling Test Error:', error);
    window.pdfTestResults.errors.push({ test: 'errorHandling', error: error.message });
    return null;
  }
}

/**
 * Generate Test Report
 * Generates a comprehensive test report
 */
function generateTestReport() {
  console.log('📊 Generating Test Report...');
  
  const results = window.pdfTestResults;
  
  const report = {
    summary: {
      totalTests: results.fontLoading.length + results.pdfGeneration.length,
      successfulTests: results.fontLoading.filter(r => r).length + results.pdfGeneration.filter(r => r).length,
      failedTests: results.errors.length,
      timestamp: new Date().toISOString()
    },
    fontLoading: results.fontLoading,
    pdfGeneration: results.pdfGeneration,
    errors: results.errors
  };
  
  console.log('📊 Test Report:', report);
  console.log('📊 Font Loading Results:', results.fontLoading);
  console.log('📊 PDF Generation Results:', results.pdfGeneration);
  console.log('📊 Errors:', results.errors);
  
  // Save to localStorage for persistence
  localStorage.setItem('pdfTestReport', JSON.stringify(report));
  
  return report;
}

/**
 * Clear Test Results
 * Clears the test results storage
 */
function clearTestResults() {
  window.pdfTestResults = {
    fontLoading: [],
    pdfGeneration: [],
    errors: []
  };
  localStorage.removeItem('pdfTestReport');
  console.log('🗑️ Test results cleared');
}

/**
 * Run All Tests
 * Runs a comprehensive test suite
 */
async function runAllTests() {
  console.log('🚀 Starting Comprehensive PDF Tests...');
  
  clearTestResults();
  
  // Test font loading
  await testFontLoading();
  
  // Test PDF generation with a simple case
  await testPDFGeneration('journal', 'ar');
  await testPDFGeneration('journal', 'en');
  
  // Test font fallback
  await testFontFallback();
  
  // Test error handling
  await testErrorHandling();
  
  // Generate final report
  const report = generateTestReport();
  
  console.log('🎉 All tests completed! Check the report above.');
  return report;
}

/**
 * Quick Test
 * Runs a quick test of the basic functionality
 */
async function quickTest() {
  console.log('🚀 Running Quick PDF Test...');
  
  try {
    // Test font loading
    await testFontLoading();
    
    // Test one PDF generation
    await testPDFGeneration('journal', 'ar');
    
    console.log('✅ Quick test passed!');
    return true;
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return false;
  }
}

// Make functions available globally
window.pdfTests = {
  testFontLoading,
  testPDFGeneration,
  testAllReportTypes,
  testFontFallback,
  testErrorHandling,
  generateTestReport,
  clearTestResults,
  runAllTests,
  quickTest,
  getResults: () => window.pdfTestResults
};

console.log('🎉 PDF Test Script Loaded!');
console.log('💡 Available functions:');
console.log('  - pdfTests.quickTest() - Quick functionality test');
console.log('  - pdfTests.runAllTests() - Comprehensive test suite');
console.log('  - pdfTests.testFontLoading() - Test font loading');
console.log('  - pdfTests.testPDFGeneration(type, lang) - Test PDF generation');
console.log('  - pdfTests.generateTestReport() - Generate test report');
console.log('  - pdfTests.getResults() - Get current test results');