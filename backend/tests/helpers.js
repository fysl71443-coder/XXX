/**
 * Helper functions for Playwright tests
 * Shared utilities to avoid code duplication
 */

/**
 * Setup smart console error handler
 * Ignores non-critical errors (404 for static assets)
 * Only throws on critical JavaScript errors
 */
export function setupConsoleErrorHandler(page) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const ignoredPatterns = [
        /404.*favicon/i,
        /404.*\.ico/i,
        /404.*\.png/i,
        /404.*\.jpg/i,
        /404.*\.svg/i,
        /404.*\.woff/i,
        /404.*\.ttf/i,
        /Failed to load resource.*404/i,
        /net::ERR_/i,
      ];
      
      const shouldIgnore = ignoredPatterns.some(pattern => pattern.test(text));
      if (!shouldIgnore) {
        // Only throw for critical JavaScript errors
        if (text.includes('Uncaught') || 
            text.includes('ReferenceError') || 
            text.includes('TypeError') ||
            text.includes('SyntaxError')) {
          throw new Error(`Critical console error: ${text}`);
        }
      }
    }
  });
}

/**
 * Setup smart network error handler
 * Ignores 404 for static assets
 * Only throws on API errors or server errors
 */
export function setupNetworkErrorHandler(page) {
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    
    if (status >= 400) {
      // Ignore 404 for static assets
      const staticAssetPatterns = [
        /favicon/i,
        /\.ico$/i,
        /\.png$/i,
        /\.jpg$/i,
        /\.svg$/i,
        /\.woff/i,
        /\.ttf/i,
        /manifest\.json/i,
      ];
      
      const isStaticAsset = staticAssetPatterns.some(pattern => pattern.test(url));
      const isApiError = url.includes('/api/');
      
      // Only fail on API errors or non-static server errors
      if (isApiError && status >= 400) {
        throw new Error(`API error: ${status} ${url}`);
      } else if (!isStaticAsset && status >= 500) {
        throw new Error(`Server error: ${status} ${url}`);
      }
    }
  });
}

/**
 * Wait for navigation with better error handling
 */
export async function waitForNavigation(page, timeout = 30000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch (e) {
    // Fallback to domcontentloaded
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch (e2) {
      // If that also fails, just wait a bit
      await page.waitForTimeout(1000);
    }
  }
}
