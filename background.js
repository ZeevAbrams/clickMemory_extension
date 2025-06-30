// Background service worker for ClickMemory extension

// Configuration
// For local development: http://localhost:3000
// For production: https://click-memory.vercel.app
const DEFAULT_WEB_APP_URL = 'https://click-memory.vercel.app';
const REFRESH_INTERVAL = 2 ; // 2 minutes

// Get the current web app URL from storage or use default
async function getWebAppUrl() {
  const result = await chrome.storage.local.get(['webAppUrl']);
  return result.webAppUrl || DEFAULT_WEB_APP_URL;
}

// Periodic sync of snippets (every 1/2/ minute)
let syncInterval;

// Flag to prevent multiple simultaneous context menu creation
let isCreatingContextMenu = false;

function startPeriodicSync() {
  // Clear existing interval
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  // Set up new interval
  syncInterval = setInterval(async () => {
    try {
      console.log('Running periodic sync...');
      
      const result = await chrome.storage.local.get(['apiKey']);
      const apiKey = result.apiKey;
      
      if (!apiKey) {
        console.log('No API key, skipping sync');
        return;
      }
      
      // Get the current web app URL
      const webAppUrl = await getWebAppUrl();
      
      // Fetch fresh snippets
      const response = await fetch(`${webAppUrl}/api/snippets?context_menu=true`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ChromeExtension/1.0'
        }
      });
      
      if (!response.ok) {
        console.error('Sync failed:', response.status);
        return;
      }
      
      const data = await response.json();
      const snippets = data.snippets || [];
      
      console.log('Periodic sync: fetched', snippets.length, 'snippets');
      
      // Update cached snippets
      await chrome.storage.local.set({ cachedSnippets: snippets });
      
      // Update context menu
      await createContextMenu();
      
    } catch (error) {
      console.error('Periodic sync error:', error);
    }
  }, REFRESH_INTERVAL * 60 * 1000); // eg 2 minute
  
  console.log('Periodic sync started');
}

function stopPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('Periodic sync stopped');
  }
}

// Start periodic sync when extension loads
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup - starting periodic sync');
  startPeriodicSync();
});

// Start periodic sync when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated - starting periodic sync');
  startPeriodicSync();
});

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

// Listen for changes to storage (like when API key is set)
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (changes.apiKey || changes.webAppUrl) {
    // Recreate context menu when API key or URL changes
    setTimeout(() => createContextMenu(), 500);
  }
});

// Create context menu on startup
createContextMenu();

// Create context menu with snippets
async function createContextMenu() {
  // Prevent multiple simultaneous calls
  if (isCreatingContextMenu) {
    console.log('Context menu creation already in progress, skipping...');
    return;
  }
  
  isCreatingContextMenu = true;
  
  try {
    console.log('Creating context menu...');
    
    // Always remove existing context menu items first
    await chrome.contextMenus.removeAll();
    console.log('Removed existing context menu items');
    
    // Small delay to ensure removal is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get API key and stored snippets
    const result = await chrome.storage.local.get(['apiKey', 'cachedSnippets']);
    const apiKey = result.apiKey;
    const cachedSnippets = result.cachedSnippets || [];
    
    console.log('API key exists:', !!apiKey);
    console.log('Cached snippets count:', cachedSnippets.length);
    console.log('Cached snippet titles:', cachedSnippets.map(s => s.title));
    
    if (!apiKey) {
      // No API key, create setup menu item
      chrome.contextMenus.create({
        id: 'clickmemory-setup',
        title: 'ClickMemory: Setup Required',
        contexts: ['editable']
      });
      console.log('Created setup menu item');
      return;
    }
    
    if (cachedSnippets.length === 0) {
      // No snippets available
      chrome.contextMenus.create({
        id: 'clickmemory-no-snippets',
        title: 'ClickMemory: No snippets available',
        contexts: ['editable']
      });
      console.log('Created no snippets menu item');
      return;
    }
    
    // Create parent menu
    chrome.contextMenus.create({
      id: 'clickmemory-parent',
      title: 'ClickMemory',
      contexts: ['editable']
    });
    
    console.log('Created parent menu');
    
    // Create menu items for each snippet from local storage
    for (const snippet of cachedSnippets) {
      try {
        chrome.contextMenus.create({
          id: `clickmemory-snippet-${snippet.id}`,
          parentId: 'clickmemory-parent',
          title: snippet.title.length > 30 ? snippet.title.substring(0, 30) + '...' : snippet.title,
          contexts: ['editable']
        });
        console.log('Created menu item for snippet:', snippet.title);
      } catch (error) {
        console.error('Error creating menu item for snippet:', snippet.id, error);
      }
    }
    
    console.log('Created', cachedSnippets.length, 'snippet menu items');
    
    // Store snippets for quick access (use cached snippets)
    await chrome.storage.local.set({ contextMenuSnippets: cachedSnippets });
    
    console.log('Context menu creation completed successfully');
    
  } catch (error) {
    console.error('Error creating context menu:', error);
    
    // Try to create error menu item
    try {
      await chrome.contextMenus.removeAll();
      chrome.contextMenus.create({
        id: 'clickmemory-error',
        title: 'ClickMemory: Error loading snippets',
        contexts: ['editable']
      });
    } catch (cleanupError) {
      console.error('Error creating error menu item:', cleanupError);
    }
  } finally {
    // Always reset the flag
    isCreatingContextMenu = false;
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);
  
  if (info.menuItemId === 'clickmemory-setup') {
    // Open setup page
    const webAppUrl = await getWebAppUrl();
    chrome.tabs.create({ url: `${webAppUrl}/auth` });
    return;
  }
  
  if (info.menuItemId === 'clickmemory-no-snippets') {
    // Open dashboard to create snippets
    const webAppUrl = await getWebAppUrl();
    chrome.tabs.create({ url: `${webAppUrl}/dashboard` });
    return;
  }
  
  if (info.menuItemId === 'clickmemory-error') {
    // Open dashboard to troubleshoot
    const webAppUrl = await getWebAppUrl();
    chrome.tabs.create({ url: `${webAppUrl}/dashboard` });
    return;
  }
  
  if (info.menuItemId.startsWith('clickmemory-snippet-')) {
    const snippetId = info.menuItemId.replace('clickmemory-snippet-', '');
    console.log('Selected snippet ID:', snippetId);
    
    try {
      // Get cached snippets from local storage
      const result = await chrome.storage.local.get(['contextMenuSnippets']);
      const snippets = result.contextMenuSnippets || [];
      
      const snippet = snippets.find(s => s.id === snippetId);
      if (!snippet) {
        console.error('Snippet not found in cache:', snippetId);
        return;
      }
      
      console.log('Found snippet:', snippet.title);
      
      // Insert the snippet content using chrome.scripting.executeScript
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: insertSnippetText,
        args: [snippet.content]
      });
      
    } catch (error) {
      console.error('Error handling snippet selection:', error);
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'updateContextMenu') {
    // Prevent multiple simultaneous calls
    if (isCreatingContextMenu) {
      console.log('Context menu creation already in progress, skipping update request');
      sendResponse({ success: false, error: 'Context menu creation already in progress' });
      return true;
    }
    
    createContextMenu().then(() => {
      console.log('Context menu updated successfully');
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error updating context menu:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
});

// Handle API requests for snippets
async function handleGetSnippets(apiKey, webAppUrl) {
  try {
    const url = `${webAppUrl}/api/snippets`;
    console.log('Background script making request to:', url);
    console.log('API Key:', apiKey.substring(0, 20) + '...');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ChromeExtension/1.0'
      }
    });

    console.log('Background response status:', response.status);
    console.log('Background response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Background error response text:', errorText);
      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { error: errorText };
      }
      throw new Error(error.error || 'Failed to fetch snippets');
    }

    const data = await response.json();
    console.log('Background success response:', data);
    return data;
  } catch (error) {
    console.error('Background API Error:', error);
    throw error;
  }
}

// Function to insert snippet text into the active element (injected into page)
function insertSnippetText(text) {
  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
    if (activeElement.isContentEditable) {
      // For contentEditable elements
      document.execCommand('insertText', false, text);
    } else {
      // For input and textarea elements
      const startPos = activeElement.selectionStart;
      const endPos = activeElement.selectionEnd;
      const beforeText = activeElement.value.substring(0, startPos);
      const afterText = activeElement.value.substring(endPos);
      activeElement.value = beforeText + text + afterText;
      
      // Trigger input event for forms that use event listeners
      const event = new Event('input', { bubbles: true });
      activeElement.dispatchEvent(event);
      
      // Set cursor position after the pasted text
      activeElement.selectionStart = activeElement.selectionEnd = startPos + text.length;
    }
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
    console.log('Text copied to clipboard successfully');
  } catch (error) {
    console.error('Clipboard error:', error);
    throw new Error('Failed to copy to clipboard');
  }
} 