// Configuration
const DEFAULT_WEB_APP_URL = 'https://click-memory-app.vercel.app';

// API class for communicating with the web app
class SnippetAPI {
  constructor(apiKey, baseUrl = DEFAULT_WEB_APP_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getSnippets() {
    try {
      const response = await fetch(`${this.baseUrl}/api/snippets`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ChromeExtension/1.0'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch snippets');
      }

      return await response.json();
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
  }

  bindEvents() {
    // Setup screen events
    this.connectBtn.addEventListener('click', () => this.connect());
    this.openWebAppLink.addEventListener('click', () => this.openWebApp());
    
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

    try {
      this.showStatus('Connecting...', 'loading');
      
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
      await navigator.clipboard.writeText(content);
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
}

// Initialize the popup when DOM is loaded
let popupUI;
document.addEventListener('DOMContentLoaded', async () => {
  popupUI = new PopupUI();
  await popupUI.initialize();
}); 