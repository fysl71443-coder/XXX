import { useState, useEffect } from 'react';

/**
 * Unified hook for language management
 * Handles localStorage sync and cross-tab communication via storage events
 * 
 * @returns {string} Current language ('ar' or 'en')
 * 
 * @example
 * const lang = useLang();
 * const text = lang === 'ar' ? 'مرحبا' : 'Hello';
 */
export function useLang() {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('lang') || 'ar';
    } catch {
      return 'ar';
    }
  });

  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key === 'lang') {
        setLang(e.newValue || 'ar');
      }
    }

    // Listen for storage events (cross-tab communication)
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events (same-tab updates)
    function handleCustomLangChange() {
      try {
        setLang(localStorage.getItem('lang') || 'ar');
      } catch {}
    }
    window.addEventListener('langChanged', handleCustomLangChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('langChanged', handleCustomLangChange);
    };
  }, []);

  /**
   * Change language and persist to localStorage
   * @param {string} newLang - 'ar' or 'en'
   */
  const setLanguage = (newLang) => {
    try {
      localStorage.setItem('lang', newLang);
      setLang(newLang);
      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event('langChanged'));
    } catch (e) {
      console.error('Failed to save language:', e);
    }
  };

  /**
   * Toggle between Arabic and English
   */
  const toggleLang = () => {
    setLanguage(lang === 'ar' ? 'en' : 'ar');
  };

  return { lang, setLanguage, toggleLang };
}

/**
 * Simple version that only returns the language string
 * Use this when you don't need to change the language
 */
export function useLangValue() {
  const { lang } = useLang();
  return lang;
}
