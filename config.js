// Configuration file for ClickMemory extension
// This file centralizes all URL configurations

// Environment detection
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.protocol === 'file:';

// URL Configuration
const CONFIG = {
  // Default URLs
  PRODUCTION_URL: 'https://click-memory.vercel.app',
  LOCALHOST_URL: 'http://localhost:3000',
  
  // Get the appropriate default URL based on environment
  getDefaultUrl() {
    return isDevelopment ? this.LOCALHOST_URL : this.PRODUCTION_URL;
  },
  
  // Get the current URL from storage or use default
  async getCurrentUrl() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(['webAppUrl']);
      return result.webAppUrl || this.getDefaultUrl();
    }
    return this.getDefaultUrl();
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
} 