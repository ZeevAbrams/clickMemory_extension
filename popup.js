// Configuration
// For local development: http://localhost:3000
// For production: https://click-memory.vercel.app
const DEFAULT_WEB_APP_URL = 'https://click-memory.vercel.app';

// Tracking function for extension events
async function trackEvent(eventName, properties = {}) {
  try {
    const result = await chrome.storage.local.get(['apiKey']);
    const apiKey = result.apiKey;
    
    await fetch('https://click-memory.vercel.app/api/track', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ 
        eventName, 
        properties,
        userId: apiKey ? 'extension_user' : 'anonymous'
      })
    });
  } catch (error) {
    console.error('Tracking error:', error);
  }
}

// API class for communicating with the web app
class SnippetAPI {
  constructor(apiKey, baseUrl = DEFAULT_WEB_APP_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getSnippets() {
    try {
      const url = `${this.baseUrl}/api/snippets`;
      console.log('Extension making request to:', url);
      console.log('API Key:', this.apiKey.substring(0, 20) + '...');
      console.log('Base URL:', this.baseUrl);
      
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ChromeExtension/1.0'
      };
      
      console.log('Request headers:', headers);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      console.log('Response status:', response.status);
      console.log('Response status text:', response.statusText);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('Response URL:', response.url);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response text:', errorText);
        console.log('Error response length:', errorText.length);
        console.log('Error response first 100 chars:', errorText.substring(0, 100));
        
        let error;
        try {
          error = JSON.parse(errorText);
        } catch (e) {
          console.log('Failed to parse error as JSON:', e);
          error = { error: errorText };
        }
        throw new Error(error.error || 'Failed to fetch snippets');
      }

      const data = await response.json();
      console.log('Success response:', data);
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
}

// Extension state management
class ExtensionState {
  constructor() {
    this.apiKey = null;
    this.webAppUrl = DEFAULT_WEB_APP_URL;
    this.settings = {
      showSharedSnippets: true,
      showSnippetPreview: true
    };
  }

  async load() {
    const result = await chrome.storage.local.get([
      'apiKey', 
      'webAppUrl', 
      'settings'
    ]);
    
    this.apiKey = result.apiKey || null;
    // Use production URL by default
    this.webAppUrl = result.webAppUrl || 'https://click-memory.vercel.app';
    this.settings = { ...this.settings, ...result.settings };
  }

  async save() {
    await chrome.storage.local.set({
      apiKey: this.apiKey,
      webAppUrl: this.webAppUrl,
      settings: this.settings
    });
  }

  async clear() {
    await chrome.storage.local.clear();
    this.apiKey = null;
    this.webAppUrl = 'https://click-memory.vercel.app';
    this.settings = {
      showSharedSnippets: true,
      showSnippetPreview: true
    };
  }

  async forceLocalhost() {
    // Force localhost and clear any stored production URLs
    this.webAppUrl = 'http://localhost:3000';
    await chrome.storage.local.set({ webAppUrl: 'http://localhost:3000' });
    console.log('Forced localhost URL:', this.webAppUrl);
  }
}

// UI management
class PopupUI {
  constructor() {
    this.state = new ExtensionState();
    this.api = null;
    this.snippets = [];
    this.filteredSnippets = [];
    
    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    // Screens
    this.setupScreen = document.getElementById('setupScreen');
    this.mainScreen = document.getElementById('mainScreen');
    this.settingsScreen = document.getElementById('settingsScreen');
    
    // Setup screen elements
    this.apiKeyInput = document.getElementById('apiKeyInput');
    this.connectBtn = document.getElementById('connectBtn');
    this.openWebAppLink = document.getElementById('openWebApp');
    this.statusDiv = document.getElementById('status');
    
    // Main screen elements
    this.searchInput = document.getElementById('searchInput');
    this.snippetsList = document.getElementById('snippetsList');
    this.loadingState = document.getElementById('loadingState');
    this.emptyState = document.getElementById('emptyState');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.disconnectBtn = document.getElementById('disconnectBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.webAppBtn = document.getElementById('webAppBtn');
    
    // Settings screen elements
    this.backBtn = document.getElementById('backBtn');
    this.settingsApiKeyInput = document.getElementById('settingsApiKeyInput');
    this.showApiKeyBtn = document.getElementById('showApiKeyBtn');
    this.webAppUrlInput = document.getElementById('webAppUrlInput');
    this.showSharedSnippets = document.getElementById('showSharedSnippets');
    this.showSnippetPreview = document.getElementById('showSnippetPreview');
    this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
    this.resetSettingsBtn = document.getElementById('resetSettingsBtn');
    this.debugBtn = document.getElementById('debugBtn');
    this.resetBtn = document.getElementById('resetBtn');
  }

  bindEvents() {
    // Setup screen events
    this.connectBtn.addEventListener('click', () => this.connect());
    this.openWebAppLink.addEventListener('click', () => this.openWebApp());
    this.debugBtn.addEventListener('click', () => this.debugTest());
    this.resetBtn.addEventListener('click', () => this.resetToLocalhost());
    
    // Main screen events
    this.searchInput.addEventListener('input', () => this.filterSnippets());
    this.refreshBtn.addEventListener('click', () => this.loadSnippets());
    this.disconnectBtn.addEventListener('click', () => this.disconnect());
    this.settingsBtn.addEventListener('click', () => this.showSettings());
    this.webAppBtn.addEventListener('click', () => this.openWebApp());
    
    // Settings screen events
    this.backBtn.addEventListener('click', () => this.showMain());
    this.showApiKeyBtn.addEventListener('click', () => this.toggleApiKeyVisibility());
    this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    this.resetSettingsBtn.addEventListener('click', () => this.resetSettings());
  }

  async initialize() {
    await this.state.load();
    
    // Force localhost for development
    await this.state.forceLocalhost();
    
    if (this.state.apiKey) {
      this.api = new SnippetAPI(this.state.apiKey, this.state.webAppUrl);
      this.showMain();
      await this.loadSnippets();
    } else {
      this.showSetup();
    }
  }

  // Screen management
  showSetup() {
    this.setupScreen.classList.remove('hidden');
    this.mainScreen.classList.add('hidden');
    this.settingsScreen.classList.add('hidden');
  }

  showMain() {
    this.setupScreen.classList.add('hidden');
    this.mainScreen.classList.remove('hidden');
    this.settingsScreen.classList.add('hidden');
  }

  showSettings() {
    this.setupScreen.classList.add('hidden');
    this.mainScreen.classList.add('hidden');
    this.settingsScreen.classList.remove('hidden');
    this.loadSettingsForm();
  }

  // Setup functionality
  async connect() {
    const apiKey = this.apiKeyInput.value.trim();
    if (!apiKey) {
      this.showStatus('Please enter an API key', 'error');
      return;
    }

    this.showStatus('Connecting...', 'info');
    
    try {
      this.api = new SnippetAPI(apiKey, this.state.webAppUrl);
      const data = await this.api.getSnippets();
      
      if (data.snippets !== undefined) {
        this.state.apiKey = apiKey;
        await this.state.save();
        
        // Track successful connection
        trackEvent('extension_connected', {
          webAppUrl: this.state.webAppUrl
        });
        
        this.showMain();
        await this.loadSnippets();
        this.showStatus('Connected successfully!', 'success');
        setTimeout(() => this.clearStatus(), 2000);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Connection error:', error);
      this.showStatus('Connection failed: ' + error.message, 'error');
      
      // Track connection error
      trackEvent('extension_connection_error', {
        error: error.message
      });
    }
  }

  openWebApp() {
    chrome.tabs.create({ url: this.state.webAppUrl });
  }

  // Main functionality
  async loadSnippets() {
    if (!this.api) return;

    this.showLoading(true);
    try {
      const data = await this.api.getSnippets();
      this.snippets = data.snippets || [];
      this.filteredSnippets = [...this.snippets];
      this.displaySnippets();
      
      // Track snippets loaded
      trackEvent('extension_snippets_loaded', {
        snippetCount: this.snippets.length
      });
    } catch (error) {
      console.error('Error loading snippets:', error);
      this.showStatus('Failed to load snippets: ' + error.message, 'error');
      
      // Track loading error
      trackEvent('extension_snippets_load_error', {
        error: error.message
      });
    } finally {
      this.showLoading(false);
    }
  }

  filterSnippets() {
    const searchTerm = this.searchInput.value.toLowerCase();
    
    if (!searchTerm) {
      this.filteredSnippets = [...this.snippets];
    } else {
      this.filteredSnippets = this.snippets.filter(snippet =>
        snippet.title.toLowerCase().includes(searchTerm) ||
        snippet.content.toLowerCase().includes(searchTerm)
      );
    }
    
    this.displaySnippets();
  }

  displaySnippets() {
    if (this.snippets.length === 0) {
      this.snippetsList.innerHTML = `
        <div class="empty-state">
          <p>No snippets found</p>
          <p class="text-sm text-gray-500">Create snippets in the web app first</p>
        </div>
      `;
      return;
    }

    this.snippetsList.innerHTML = this.filteredSnippets.map(snippet => `
      <div class="snippet-item" data-snippet-id="${snippet.id}">
        <div class="snippet-header">
          <h3 class="snippet-title">${this.escapeHtml(snippet.title)}</h3>
          <button class="copy-btn" title="Copy to clipboard">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </button>
        </div>
        <p class="snippet-content">${this.escapeHtml(snippet.content.substring(0, 100))}${snippet.content.length > 100 ? '...' : ''}</p>
      </div>
    `).join('');

    // Add click handlers for copy buttons
    this.snippetsList.querySelectorAll('.copy-btn').forEach((btn, index) => {
      btn.addEventListener('click', () => this.copySnippet(this.filteredSnippets[index].content));
    });
  }

  async copySnippet(content) {
    try {
      await navigator.clipboard.writeText(content);
      
      // Track copy action
      trackEvent('snippet_copied_via_extension', {
        contentLength: content.length
      });
      
      // Show success feedback
      const copyBtn = event.target.closest('.copy-btn');
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = `
        <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      `;
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
      }, 1000);
    } catch (error) {
      console.error('Failed to copy:', error);
      
      // Track copy error
      trackEvent('extension_copy_error', {
        error: error.message
      });
    }
  }

  async disconnect() {
    if (confirm('Are you sure you want to disconnect? This will remove your API key.')) {
      await this.state.clear();
      this.api = null;
      this.snippets = [];
      this.showSetup();
      
      // Refresh context menu to show setup required
      await this.refreshContextMenu();
    }
  }

  // Context menu management
  async refreshContextMenu() {
    try {
      await chrome.runtime.sendMessage({ action: 'refreshContextMenu' });
    } catch (error) {
      console.error('Error refreshing context menu:', error);
    }
  }

  // Settings functionality
  loadSettingsForm() {
    this.settingsApiKeyInput.value = this.state.apiKey || '';
    this.webAppUrlInput.value = this.state.webAppUrl;
    this.showSharedSnippets.checked = this.state.settings.showSharedSnippets;
    this.showSnippetPreview.checked = this.state.settings.showSnippetPreview;
  }

  toggleApiKeyVisibility() {
    const input = this.settingsApiKeyInput;
    if (input.type === 'password') {
      input.type = 'text';
      this.showApiKeyBtn.textContent = 'Hide';
    } else {
      input.type = 'password';
      this.showApiKeyBtn.textContent = 'Show';
    }
  }

  async saveSettings() {
    this.state.webAppUrl = this.webAppUrlInput.value.trim() || DEFAULT_WEB_APP_URL;
    this.state.settings.showSharedSnippets = this.showSharedSnippets.checked;
    this.state.settings.showSnippetPreview = this.showSnippetPreview.checked;
    
    await this.state.save();
    
    // Update API instance with new URL
    if (this.state.apiKey) {
      this.api = new SnippetAPI(this.state.apiKey, this.state.webAppUrl);
    }
    
    // Refresh context menu with new settings
    await this.refreshContextMenu();
    
    this.showMain();
  }

  async resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
      this.state.webAppUrl = DEFAULT_WEB_APP_URL;
      this.state.settings = {
        showSharedSnippets: true,
        showSnippetPreview: true
      };
      await this.state.save();
      this.loadSettingsForm();
    }
  }

  // Utility methods
  showLoading(show) {
    if (show) {
      this.loadingState.classList.remove('hidden');
      this.snippetsList.classList.add('hidden');
    } else {
      this.loadingState.classList.add('hidden');
      this.snippetsList.classList.remove('hidden');
    }
  }

  showStatus(message, type) {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
  }

  clearStatus() {
    this.statusDiv.textContent = '';
    this.statusDiv.className = 'status';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async debugTest() {
    console.log('Running debug tests...');
    
    try {
      // Test 1: Basic fetch to production URL
      console.log('Test 1: Basic fetch to click-memory.vercel.app');
      const test1 = await fetch('https://click-memory.vercel.app');
      console.log('Test 1 result:', test1.status, test1.statusText);
      
      // Test 2: API endpoint test
      console.log('Test 2: API endpoint test');
      const test2 = await fetch('https://click-memory.vercel.app/api/snippets');
      console.log('Test 2 result:', test2.status, test2.statusText);
      
      // Test 3: With API key (if available)
      const result = await chrome.storage.local.get(['apiKey']);
      if (result.apiKey) {
        console.log('Test 3: API endpoint with auth');
        const test3 = await fetch('https://click-memory.vercel.app/api/snippets', {
          headers: {
            'Authorization': `Bearer ${result.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('Test 3 result:', test3.status, test3.statusText);
      }
      
      this.showStatus('Debug tests completed - check console', 'success');
    } catch (error) {
      console.error('Debug test error:', error);
      this.showStatus('Debug test failed - check console', 'error');
    }
  }

  async resetToLocalhost() {
    await this.state.forceLocalhost();
    this.showMain();
  }
}

// Fetch and cache snippets from web app
async function fetchAndCacheSnippets() {
  try {
    console.log('Fetching and caching snippets...');
    
    const result = await chrome.storage.local.get(['apiKey', 'webAppUrl']);
    const apiKey = result.apiKey;
    const webAppUrl = result.webAppUrl || 'https://click-memory.vercel.app';
    
    if (!apiKey) {
      console.log('No API key found, skipping fetch');
      return;
    }
    
    console.log('Fetching from:', webAppUrl);
    
    const response = await fetch(`${webAppUrl}/api/snippets?context_menu=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ChromeExtension/1.0'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response text:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { error: errorText };
      }
      throw new Error(error.error || 'Failed to fetch snippets');
    }

    const data = await response.json();
    console.log('Success response:', data);
    
    const snippets = data.snippets || [];
    console.log('Caching', snippets.length, 'snippets');
    
    // Cache snippets
    await chrome.storage.local.set({ cachedSnippets: snippets });
    
    // Update context menu
    chrome.runtime.sendMessage({ action: 'updateContextMenu' });
    
    console.log('Snippets cached successfully');
    
  } catch (error) {
    console.error('Error fetching and caching snippets:', error);
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup initialized');
  
  // Get stored data
  const result = await chrome.storage.local.get(['apiKey', 'webAppUrl', 'cachedSnippets']);
  const apiKey = result.apiKey;
  const webAppUrl = result.webAppUrl || 'http://localhost:3000';
  const cachedSnippets = result.cachedSnippets || [];
  
  console.log('Stored API key exists:', !!apiKey);
  console.log('Web app URL:', webAppUrl);
  console.log('Cached snippets count:', cachedSnippets.length);
  
  // Show appropriate screen
  if (!apiKey) {
    showSetupScreen();
  } else {
    showMainScreen();
    await loadSnippets();
  }
  
  // Add event listeners
  setupEventListeners();
});

// Show setup screen
function showSetupScreen() {
  document.getElementById('setupScreen').classList.remove('hidden');
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('settingsScreen').classList.add('hidden');
}

// Show main screen
function showMainScreen() {
  document.getElementById('setupScreen').classList.add('hidden');
  document.getElementById('mainScreen').classList.remove('hidden');
  document.getElementById('settingsScreen').classList.add('hidden');
}

// Show settings screen
function showSettingsScreen() {
  document.getElementById('setupScreen').classList.add('hidden');
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('settingsScreen').classList.remove('hidden');
}

// Load snippets
async function loadSnippets() {
  const snippetsList = document.getElementById('snippetsList');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  
  // Show loading state
  snippetsList.classList.add('hidden');
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  
  try {
    // Fetch fresh snippets from web app
    const snippets = await fetchAndCacheSnippets();
    
    // Hide loading state
    loadingState.classList.add('hidden');
    
    if (snippets.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      // Display snippets
      snippetsList.innerHTML = snippets.map(snippet => `
        <div class="snippet-item" data-snippet-id="${snippet.id}">
          <div class="snippet-title">${snippet.title}</div>
          <div class="snippet-preview">${snippet.content.substring(0, 50)}${snippet.content.length > 50 ? '...' : ''}</div>
        </div>
      `).join('');
      snippetsList.classList.remove('hidden');
    }
    
  } catch (error) {
    console.error('Error loading snippets:', error);
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = '<p>Error loading snippets</p>';
  }
}

// Setup event listeners
function setupEventListeners() {
  // Setup screen
  document.getElementById('connectBtn').addEventListener('click', connect);
  document.getElementById('openWebApp').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://click-memory.vercel.app/auth' });
  });
  
  // Main screen
  document.getElementById('refreshBtn').addEventListener('click', loadSnippets);
  document.getElementById('disconnectBtn').addEventListener('click', disconnect);
  document.getElementById('settingsBtn').addEventListener('click', showSettingsScreen);
  document.getElementById('webAppBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://click-memory.vercel.app/dashboard' });
  });
  
  // Settings screen
  document.getElementById('backBtn').addEventListener('click', showMainScreen);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
  document.getElementById('debugBtn').addEventListener('click', debugTest);
  document.getElementById('resetBtn').addEventListener('click', resetToLocalhost);
  
  // Search functionality
  document.getElementById('searchInput').addEventListener('input', filterSnippets);
}

// Initialize the popup when DOM is loaded
let popupUI;
document.addEventListener('DOMContentLoaded', async () => {
  popupUI = new PopupUI();
  await popupUI.initialize();
}); 