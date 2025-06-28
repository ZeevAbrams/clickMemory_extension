// Configuration
// For local development: http://localhost:3000
// For production: https://click-memory-app.vercel.app
const DEFAULT_WEB_APP_URL = 'http://localhost:3000';

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
    // Force localhost for development
    this.webAppUrl = 'http://localhost:3000';
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
    this.webAppUrl = 'http://localhost:3000';
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

    if (!apiKey.startsWith('sk_live_')) {
      this.showStatus('Invalid API key format. Should start with sk_live_', 'error');
      return;
    }

    if (apiKey.length !== 72) {
      this.showStatus('Invalid API key format. Should be 72 characters long', 'error');
      return;
    }

    try {
      this.showStatus('Connecting...', 'loading');
      
      // Test basic connectivity first
      console.log('Testing basic connectivity...');
      try {
        const testResponse = await fetch('http://localhost:3000');
        console.log('Basic connectivity test status:', testResponse.status);
      } catch (testError) {
        console.error('Basic connectivity test failed:', testError);
        this.showStatus(`Basic connectivity failed: ${testError.message}`, 'error');
        return;
      }
      
      // Test the API key
      const testApi = new SnippetAPI(apiKey, this.state.webAppUrl);
      const data = await testApi.getSnippets();
      
      // Save the API key
      this.state.apiKey = apiKey;
      await this.state.save();
      
      this.api = testApi;
      this.showStatus(`Connected! Found ${data.total_count} snippets`, 'success');
      
      // Refresh context menu
      await this.refreshContextMenu();
      
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
    chrome.tabs.create({ url: this.state.webAppUrl });
  }

  // Main functionality
  async loadSnippets() {
    if (!this.api) return;

    try {
      this.showLoading(true);
      const data = await this.api.getSnippets();
      this.snippets = data.snippets || [];
      this.filteredSnippets = [...this.snippets];
      this.displaySnippets();
      
      // Refresh context menu after loading snippets
      await this.refreshContextMenu();
    } catch (error) {
      console.error('Error loading snippets:', error);
      this.showStatus(`Failed to load snippets: ${error.message}`, 'error');
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
    if (this.filteredSnippets.length === 0) {
      this.snippetsList.innerHTML = '';
      this.emptyState.classList.remove('hidden');
      return;
    }

    this.emptyState.classList.add('hidden');
    
    const snippetsHtml = this.filteredSnippets.map(snippet => {
      const preview = this.state.settings.showSnippetPreview 
        ? snippet.content.substring(0, 100) + (snippet.content.length > 100 ? '...' : '')
        : '';
      
      const sharedBadge = snippet.is_shared 
        ? '<span class="shared-badge">Shared</span>' 
        : '';
      
      const contextMenuBadge = snippet.is_public 
        ? '<span class="context-menu-badge">Context Menu</span>' 
        : '';
      
      return `
        <div class="snippet-item" data-snippet-id="${snippet.id}">
          <h3>${this.escapeHtml(snippet.title)}</h3>
          ${preview ? `<p>${this.escapeHtml(preview)}</p>` : ''}
          <div class="snippet-actions">
            <button class="copy-btn" onclick="popupUI.copySnippet('${this.escapeHtml(snippet.content)}')">
              Copy
            </button>
            ${sharedBadge}
            ${contextMenuBadge}
          </div>
        </div>
      `;
    }).join('');
    
    this.snippetsList.innerHTML = snippetsHtml;
  }

  async copySnippet(content) {
    try {
      // Use the background script's clipboard functionality
      await chrome.runtime.sendMessage({ 
        action: 'copyToClipboard', 
        text: content 
      });
      this.showStatus('Snippet copied to clipboard!', 'success');
      setTimeout(() => this.clearStatus(), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      this.showStatus('Failed to copy snippet', 'error');
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
    console.log('=== DEBUG TEST START ===');
    console.log('Current web app URL:', this.state.webAppUrl);
    console.log('Default web app URL:', DEFAULT_WEB_APP_URL);
    
    try {
      this.showStatus('Running debug test...', 'loading');
      
      // Test 1: Basic fetch to localhost
      console.log('Test 1: Basic fetch to localhost:3000');
      const test1 = await fetch('http://localhost:3000');
      console.log('Test 1 result:', test1.status, test1.statusText);
      
      // Test 2: Fetch to the configured URL
      console.log('Test 2: Fetch to configured URL:', this.state.webAppUrl);
      const test2 = await fetch(this.state.webAppUrl);
      console.log('Test 2 result:', test2.status, test2.statusText);
      
      // Test 3: Fetch to API endpoint
      console.log('Test 3: Fetch to API endpoint');
      const test3 = await fetch(`${this.state.webAppUrl}/api/snippets`);
      console.log('Test 3 result:', test3.status, test3.statusText);
      
      this.showStatus('Debug test completed - check console', 'success');
      
    } catch (error) {
      console.error('Debug test failed:', error);
      this.showStatus(`Debug test failed: ${error.message}`, 'error');
    }
    
    console.log('=== DEBUG TEST END ===');
  }

  async resetToLocalhost() {
    await this.state.forceLocalhost();
    this.showMain();
  }
}

// Fetch and cache snippets from web app
async function fetchAndCacheSnippets() {
  try {
    const result = await chrome.storage.local.get(['apiKey']);
    const apiKey = result.apiKey;
    
    if (!apiKey) {
      console.log('No API key found');
      return [];
    }
    
    console.log('Fetching snippets from web app...');
    
    const response = await fetch('http://localhost:3000/api/snippets?context_menu=true', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ChromeExtension/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const snippets = data.snippets || [];
    
    console.log('Fetched', snippets.length, 'snippets from web app');
    
    // Cache snippets in local storage
    await chrome.storage.local.set({ cachedSnippets: snippets });
    
    console.log('Snippets cached successfully');
    
    // Update context menu with new snippets
    await chrome.runtime.sendMessage({ action: 'updateContextMenu' });
    
    return snippets;
    
  } catch (error) {
    console.error('Error fetching snippets:', error);
    return [];
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
  document.getElementById('openWebApp').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'http://localhost:3000/auth' });
  });
  
  document.getElementById('connectBtn').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    if (apiKey) {
      await chrome.storage.local.set({ apiKey });
      showMainScreen();
      await loadSnippets();
    }
  });
  
  document.getElementById('resetBtn').addEventListener('click', async () => {
    await chrome.storage.local.clear();
    showSetupScreen();
  });
  
  // Main screen
  document.getElementById('settingsBtn').addEventListener('click', () => {
    showSettingsScreen();
  });
  
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await loadSnippets();
  });
  
  document.getElementById('disconnectBtn').addEventListener('click', async () => {
    await chrome.storage.local.clear();
    showSetupScreen();
  });
  
  document.getElementById('syncBtn').addEventListener('click', async () => {
    await loadSnippets();
  });
  
  // Settings screen
  document.getElementById('backBtn').addEventListener('click', () => {
    showMainScreen();
  });
  
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const webAppUrl = document.getElementById('webAppUrlInput').value.trim();
    if (webAppUrl) {
      await chrome.storage.local.set({ webAppUrl });
    }
    showMainScreen();
  });
  
  document.getElementById('resetSettingsBtn').addEventListener('click', async () => {
    await chrome.storage.local.set({ webAppUrl: 'http://localhost:3000' });
    document.getElementById('webAppUrlInput').value = 'http://localhost:3000';
  });
}

// Initialize the popup when DOM is loaded
let popupUI;
document.addEventListener('DOMContentLoaded', async () => {
  popupUI = new PopupUI();
  await popupUI.initialize();
}); 