// Language Manager for Nightreign Map Seed Recognizer
class LanguageManager {
  constructor() {
    this.cookieManager = new CookieManager();
    this.currentLang = this.detectLanguage();
    this.translations = translations;
    this.initialized = false;
    this.languageChangeListeners = [];
    
    // Wait for DOM to be ready before initializing
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.init();
      });
    } else {
      this.init();
    }
  }

  detectLanguage() {
    // Priority order:
    // 1. URL query parameter (highest priority)
    // 2. Cookie
    // 3. localStorage
    // 4. Browser language
    // 5. Default

    // 1. Check URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang && ['zh', 'en'].includes(urlLang)) {
      console.log('Language from URL:', urlLang);
      return urlLang;
    }

    // 2. Check cookie
    const cookieLang = this.cookieManager.getCookie('preferred-language');
    if (cookieLang && ['zh', 'en'].includes(cookieLang)) {
      console.log('Language from cookie:', cookieLang);
      return cookieLang;
    }

    // 3. Check localStorage
    const saved = localStorage.getItem('preferred-language');
    if (saved && ['zh', 'en'].includes(saved)) {
      console.log('Language from localStorage:', saved);
      return saved;
    }

    // 4. Check browser language
    const browserLang = navigator.language.split('-')[0];
    if (['zh', 'en'].includes(browserLang)) {
      console.log('Language from browser:', browserLang);
      return browserLang;
    }

    // 5. Default
    console.log('Using default language: zh');
    return 'zh';
  }

  async init() {
    // Update HTML lang attribute
    document.documentElement.lang = this.currentLang;
    document.documentElement.setAttribute('data-lang', this.currentLang);
    
    // Update all text content
    this.updateUI();
    
    // Update asset paths
    this.updateAssets();
    
    // Set up language toggle - wait for DOM to be ready
    this.setupLanguageToggle();
    
    this.initialized = true;
    console.log('LanguageManager initialized with language:', this.currentLang);
  }

  switchLanguage(lang) {
    if (!['zh', 'en'].includes(lang)) {
      console.warn('Invalid language:', lang);
      return;
    }

    this.currentLang = lang;
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-lang', lang);
    
    // Update URL without page reload
    this.updateURL(lang);
    
    // Save to all storage methods
    localStorage.setItem('preferred-language', lang);
    this.cookieManager.setCookie('preferred-language', lang, 365);
    
    // Update UI and assets
    this.updateUI();
    this.updateAssets();
    
    // Notify custom listeners
    this.languageChangeListeners.forEach(listener => {
      try {
        listener(lang);
      } catch (error) {
        console.warn('Error in language change listener:', error);
      }
    });
    
    // Trigger custom event for other components
    window.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { language: lang } 
    }));
  }

  addLanguageChangeListener(callback) {
    this.languageChangeListeners.push(callback);
  }

  updateURL(lang) {
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url);
  }

  updateUI() {
    // Update all elements with data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const text = this.getText(key);
      if (text) {
        if (element.tagName === 'INPUT' && element.type === 'text') {
          element.value = text;
        } else if (element.hasAttribute('data-i18n-html')) {
          element.innerHTML = text;
        } else {
          element.textContent = text;
        }
      }
    });

    // Update title and meta tags
    document.title = this.getText('app.title');
    this.updateMetaTag('description', this.getText('app.description'));
    this.updateMetaTag('keywords', this.getText('app.keywords'));
  }

  updateMetaTag(name, content) {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (meta) {
      meta.setAttribute('content', content);
    }
  }

  updateAssets() {
    // Update pattern image paths
    this.updatePatternImages();
    
    // Trigger asset update event
    window.dispatchEvent(new CustomEvent('assetsUpdated', { 
      detail: { language: this.currentLang } 
    }));
  }

  updatePatternImages() {
    // This will be called by the main app to update pattern image paths
    // The actual implementation will be in the main script.js
  }

  setupLanguageToggle() {
    // Use a small delay to ensure DOM is ready
    setTimeout(() => {
      const toggleBtn = document.getElementById('lang-toggle');
      console.log('Looking for toggle button, found:', toggleBtn);
      
      if (toggleBtn) {
        console.log('Setting up language toggle button');
        
        // Remove any existing event listeners
        const newToggleBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
        
        newToggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const newLang = this.currentLang === 'zh' ? 'en' : 'zh';
          console.log('Language toggle clicked, switching from', this.currentLang, 'to:', newLang);
          this.switchLanguage(newLang);
        });
        
        console.log('Language toggle button setup complete');
      } else {
        console.warn('Language toggle button not found! Available elements:');
        console.log('All buttons:', document.querySelectorAll('button'));
        console.log('All elements with id:', document.querySelectorAll('[id]'));
      }
    }, 200);
  }

  getText(key, params = {}) {
    const text = this.translations[this.currentLang]?.[key];
    if (!text) {
      console.warn(`Translation missing for key: ${key} in language: ${this.currentLang}`);
      return key; // Return key as fallback
    }

    // Simple parameter replacement
    let result = text;
    Object.keys(params).forEach(param => {
      result = result.replace(`{${param}}`, params[param]);
    });

    return result;
  }

  getCurrentLanguage() {
    return this.currentLang;
  }

  isChinese() {
    return this.currentLang === 'zh';
  }

  isEnglish() {
    return this.currentLang === 'en';
  }
}

// Cookie Manager
class CookieManager {
  // Set cookie with expiration
  setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    const secure = location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax${secure}`;
  }

  // Get cookie value
  getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  // Delete cookie
  deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LanguageManager, CookieManager };
}
