// Configuration
// For local development: http://localhost:3000
// For production: https://click-memory.vercel.app
const DEFAULT_WEB_APP_URL = 'https://click-memory.vercel.app';

// Get the current web app URL from storage or use default
async function getWebAppUrl() {
  const result = await chrome.storage.local.get(['webAppUrl']);
  return result.webAppUrl || DEFAULT_WEB_APP_URL;
}

// Tracking function for extension events
async function trackEvent(eventName, properties = {}) {
  try {
    const result = await chrome.storage.local.get(['apiKey']);
    const apiKey = result.apiKey;
    
    const webAppUrl = await getWebAppUrl();
    
    await fetch(`${webAppUrl}/api/track`, {
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

  async getContextMenuSnippets() {
    try {
      const url = `${this.baseUrl}/api/snippets?context_menu=true`;
      console.log('Extension making context menu request to:', url);
      
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ChromeExtension/1.0'
      };
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      console.log('Context menu response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch (e) {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Failed to fetch context menu snippets');
      }

      const data = await response.json();
      console.log('Context menu success response:', data);
      return data;
    } catch (error) {
      console.error('Context Menu API Error:', error);
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
    // Use stored URL or default
    this.webAppUrl = result.webAppUrl || DEFAULT_WEB_APP_URL;
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
    this.webAppUrl = DEFAULT_WEB_APP_URL;
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
    this.allSnippetsBtn = document.getElementById('allSnippetsBtn');
    this.syncBtn = document.getElementById('syncBtn');
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
    this.allSnippetsBtn.addEventListener('click', () => this.loadAllSnippets());
    this.syncBtn.addEventListener('click', () => this.refreshContextMenu());
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
    
    if (this.state.apiKey) {
      this.api = new SnippetAPI(this.state.apiKey, this.state.webAppUrl);
      this.showMain();
      await this.loadSnippets();
    } else {
      this.showSetup();
    }
  }

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

  async connect() {
    const apiKey = this.apiKeyInput.value.trim();
    if (!apiKey) {
      this.showStatus('Please enter an API key', 'error');
      return;
    }

    this.showStatus('Connecting...', 'loading');
    
    try {
      this.state.apiKey = apiKey;
      this.api = new SnippetAPI(apiKey, this.state.webAppUrl);
      
      // Test the connection
      await this.api.getSnippets();
      
      await this.state.save();
      this.showStatus('Connected successfully!', 'success');
      
      setTimeout(() => {
        this.showMain();
        this.loadSnippets();
      }, 1000);
      
    } catch (error) {
      console.error('Connection error:', error);
      this.showStatus(`Connection failed: ${error.message}`, 'error');
    }
  }

  openWebApp() {
    chrome.tabs.create({ url: `${this.state.webAppUrl}/auth` });
  }

  async loadSnippets() {
    if (!this.api) {
      console.error('No API available');
      return;
    }

    this.showLoading(true);
    
    try {
      // Fetch context menu snippets for popup display (default view)
      const contextMenuData = await this.api.getContextMenuSnippets();
      const contextMenuSnippets = contextMenuData.snippets || [];
      
      console.log('Fetched context menu snippets for popup:', contextMenuSnippets.length);
      
      // Use context menu snippets for popup display
      this.snippets = contextMenuSnippets;
      this.filteredSnippets = [...this.snippets];
      
      // Cache context menu snippets for context menu
      await chrome.storage.local.set({ cachedSnippets: contextMenuSnippets });
      
      // Update context menu
      chrome.runtime.sendMessage({ action: 'updateContextMenu' });
      
      this.displaySnippets();
      
    } catch (error) {
      console.error('Error loading snippets:', error);
      this.showStatus(`Failed to load snippets: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async loadAllSnippets() {
    if (!this.api) {
      console.error('No API available');
      return;
    }

    this.showLoading(true);
    
    try {
      // Fetch all snippets for popup display
      const data = await this.api.getSnippets();
      const allSnippets = data.snippets || [];
      
      console.log('Fetched all snippets for popup:', allSnippets.length);
      
      // Use all snippets for popup display
      this.snippets = allSnippets;
      this.filteredSnippets = [...this.snippets];
      
      // Still cache context menu snippets for context menu
      try {
        const contextMenuData = await this.api.getContextMenuSnippets();
        const contextMenuSnippets = contextMenuData.snippets || [];
        await chrome.storage.local.set({ cachedSnippets: contextMenuSnippets });
        chrome.runtime.sendMessage({ action: 'updateContextMenu' });
      } catch (contextMenuError) {
        console.error('Error fetching context menu snippets:', contextMenuError);
      }
      
      this.displaySnippets();
      
    } catch (error) {
      console.error('Error loading all snippets:', error);
      this.showStatus(`Failed to load snippets: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  filterSnippets() {
    const query = this.searchInput.value.toLowerCase();
    this.filteredSnippets = this.snippets.filter(snippet =>
      snippet.title.toLowerCase().includes(query) ||
      snippet.content.toLowerCase().includes(query)
    );
    this.displaySnippets();
  }

  displaySnippets() {
    if (this.filteredSnippets.length === 0) {
      this.snippetsList.innerHTML = '<div class="empty-state">No snippets found</div>';
      return;
    }

    this.snippetsList.innerHTML = this.filteredSnippets.map(snippet => `
      <div class="snippet-item" data-snippet-id="${snippet.id}">
        <div class="snippet-title">${this.escapeHtml(snippet.title)}</div>
        ${this.state.settings.showSnippetPreview ? 
          `<div class="snippet-preview">${this.escapeHtml(snippet.content.substring(0, 100))}${snippet.content.length > 100 ? '...' : ''}</div>` : 
          ''
        }
        <div class="snippet-actions">
          <button class="copy-btn" onclick="popupUI.copySnippet('${this.escapeHtml(snippet.content)}')">Copy</button>
        </div>
      </div>
    `).join('');
  }

  async copySnippet(content) {
    try {
      await navigator.clipboard.writeText(content);
      this.showStatus('Snippet copied to clipboard!', 'success');
    } catch (error) {
      console.error('Copy error:', error);
      this.showStatus('Failed to copy snippet', 'error');
    }
  }

  async disconnect() {
    await this.state.clear();
    this.api = null;
    this.snippets = [];
    this.filteredSnippets = [];
    this.showSetup();
  }

  async refreshContextMenu() {
    if (!this.api) {
      console.error('No API available');
      this.showStatus('No API available', 'error');
      return;
    }

    try {
      this.showStatus('Refreshing context menu...', 'loading');
      
      console.log('Starting context menu refresh...');
      
      // Fetch fresh context menu snippets
      const contextMenuData = await this.api.getContextMenuSnippets();
      const contextMenuSnippets = contextMenuData.snippets || [];
      
      console.log('Refreshed context menu snippets:', contextMenuSnippets.length);
      console.log('Snippet titles:', contextMenuSnippets.map(s => s.title));
      
      // Cache fresh context menu snippets
      await chrome.storage.local.set({ cachedSnippets: contextMenuSnippets });
      console.log('Cached context menu snippets in storage');
      
      // Update context menu
      const result = await chrome.runtime.sendMessage({ action: 'updateContextMenu' });
      console.log('Context menu update result:', result);
      
      this.showStatus(`Context menu updated with ${contextMenuSnippets.length} snippets`, 'success');
    } catch (error) {
      console.error('Error refreshing context menu:', error);
      this.showStatus('Failed to refresh context menu', 'error');
    }
  }

  loadSettingsForm() {
    this.settingsApiKeyInput.value = this.state.apiKey || '';
    this.webAppUrlInput.value = this.state.webAppUrl;
    this.showSharedSnippets.checked = this.state.settings.showSharedSnippets;
    this.showSnippetPreview.checked = this.state.settings.showSnippetPreview;
  }

  toggleApiKeyVisibility() {
    const input = this.settingsApiKeyInput;
    input.type = input.type === 'password' ? 'text' : 'password';
    this.showApiKeyBtn.textContent = input.type === 'password' ? 'Show' : 'Hide';
  }

  async saveSettings() {
    const apiKey = this.settingsApiKeyInput.value.trim();
    const webAppUrl = this.webAppUrlInput.value.trim();
    
    this.state.apiKey = apiKey;
    this.state.webAppUrl = webAppUrl;
    this.state.settings.showSharedSnippets = this.showSharedSnippets.checked;
    this.state.settings.showSnippetPreview = this.showSnippetPreview.checked;
    
    if (apiKey) {
      this.api = new SnippetAPI(apiKey, webAppUrl);
    }
    
    await this.state.save();
    this.showStatus('Settings saved!', 'success');
    
    setTimeout(() => this.showMain(), 1000);
  }

  async resetSettings() {
    this.state.webAppUrl = DEFAULT_WEB_APP_URL;
    this.state.settings = {
      showSharedSnippets: true,
      showSnippetPreview: true
    };
    
    this.webAppUrlInput.value = DEFAULT_WEB_APP_URL;
    this.showSharedSnippets.checked = true;
    this.showSnippetPreview.checked = true;
    
    await this.state.save();
    this.showStatus('Settings reset to defaults', 'success');
  }

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
    this.statusDiv.classList.remove('hidden');
    
    setTimeout(() => {
      this.statusDiv.classList.add('hidden');
    }, 3000);
  }

  clearStatus() {
    this.statusDiv.classList.add('hidden');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async debugTest() {
    console.log('Running debug tests...');
    
    try {
      // Test 1: Basic fetch to current URL
      console.log('Test 1: Basic fetch to current web app URL');
      const test1 = await fetch(this.state.webAppUrl);
      console.log('Test 1 result:', test1.status, test1.statusText);
      
      // Test 2: API endpoint test
      console.log('Test 2: API endpoint test');
      const test2 = await fetch(`${this.state.webAppUrl}/api/snippets`);
      console.log('Test 2 result:', test2.status, test2.statusText);
      
      // Test 3: With API key (if available)
      const result = await chrome.storage.local.get(['apiKey']);
      if (result.apiKey) {
        console.log('Test 3: API endpoint with auth');
        const test3 = await fetch(`${this.state.webAppUrl}/api/snippets`, {
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

// Initialize the popup when DOM is loaded
let popupUI;
document.addEventListener('DOMContentLoaded', async () => {
  popupUI = new PopupUI();
  await popupUI.initialize();
}); 