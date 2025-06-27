// Background service worker for ClickMemory extension

// Configuration
const DEFAULT_WEB_APP_URL = 'https://click-memory-app.vercel.app';

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      webAppUrl: DEFAULT_WEB_APP_URL,
      settings: {
        showSharedSnippets: true,
        showSnippetPreview: true
      }
    });
  }
  
  // Create context menu
  createContextMenu();
});

// Create context menu with snippets
async function createContextMenu() {
  try {
    // Remove existing context menu items
    await chrome.contextMenus.removeAll();
    
    // Get API key and web app URL
    const result = await chrome.storage.local.get(['apiKey', 'webAppUrl']);
    const apiKey = result.apiKey;
    const webAppUrl = result.webAppUrl || DEFAULT_WEB_APP_URL;
    
    if (!apiKey) {
      // No API key, create setup menu item
      chrome.contextMenus.create({
        id: 'clickmemory-setup',
        title: 'ClickMemory: Setup Required',
        contexts: ['editable']
      });
      return;
    }
    
    // Fetch context menu snippets
    const response = await fetch(`${webAppUrl}/api/snippets?context_menu=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ChromeExtension/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch snippets');
    }
    
    const data = await response.json();
    const snippets = data.snippets || [];
    
    if (snippets.length === 0) {
      // No snippets available
      chrome.contextMenus.create({
        id: 'clickmemory-no-snippets',
        title: 'ClickMemory: No snippets available',
        contexts: ['editable']
      });
      return;
    }
    
    // Create parent menu
    chrome.contextMenus.create({
      id: 'clickmemory-parent',
      title: 'ClickMemory',
      contexts: ['editable']
    });
    
    // Create menu items for each snippet
    snippets.forEach((snippet, index) => {
      chrome.contextMenus.create({
        id: `clickmemory-snippet-${snippet.id}`,
        parentId: 'clickmemory-parent',
        title: snippet.title.length > 30 ? snippet.title.substring(0, 30) + '...' : snippet.title,
        contexts: ['editable']
      });
    });
    
    // Store snippets for quick access
    await chrome.storage.local.set({ contextMenuSnippets: snippets });
    
  } catch (error) {
    console.error('Error creating context menu:', error);
    
    // Create error menu item
    chrome.contextMenus.create({
      id: 'clickmemory-error',
      title: 'ClickMemory: Error loading snippets',
      contexts: ['editable']
    });
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = info.menuItemId;
  
  if (menuId === 'clickmemory-setup') {
    // Open extension popup for setup
    chrome.action.openPopup();
    return;
  }
  
  if (menuId === 'clickmemory-no-snippets' || menuId === 'clickmemory-error') {
    // Open extension popup
    chrome.action.openPopup();
    return;
  }
  
  if (menuId.startsWith('clickmemory-snippet-')) {
    // Insert snippet into the active text field
    const snippetId = menuId.replace('clickmemory-snippet-', '');
    
    try {
      // Get snippets from storage
      const result = await chrome.storage.local.get(['contextMenuSnippets']);
      const snippets = result.contextMenuSnippets || [];
      
      const snippet = snippets.find(s => s.id === snippetId);
      if (!snippet) {
        console.error('Snippet not found:', snippetId);
        return;
      }
      
      // Send message to content script to insert snippet
      await chrome.tabs.sendMessage(tab.id, {
        action: 'insertSnippet',
        text: snippet.content
      });
      
    } catch (error) {
      console.error('Error inserting snippet:', error);
    }
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getSnippets':
      handleGetSnippets(request.apiKey, request.webAppUrl)
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
      return true; // Keep message channel open for async response
    
    case 'copyToClipboard':
      handleCopyToClipboard(request.text)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    
    case 'refreshContextMenu':
      createContextMenu()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ error: error.message }));
      return true;
    
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle API requests for snippets
async function handleGetSnippets(apiKey, webAppUrl) {
  try {
    const response = await fetch(`${webAppUrl}/api/snippets`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
    console.error('Background API Error:', error);
    throw error;
  }
}

// Handle clipboard operations
async function handleCopyToClipboard(text) {
  try {
    // Use the clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  } catch (error) {
    console.error('Clipboard error:', error);
    throw new Error('Failed to copy to clipboard');
  }
} 