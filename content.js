// Content script for ClickMemory extension
// Handles snippet insertion into text inputs and textareas

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'insertSnippet':
      insertSnippetAtCursor(request.text);
      sendResponse({ success: true });
      break;
    
    case 'getSelectedText':
      sendResponse({ text: window.getSelection().toString() });
      break;
    
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Function to insert snippet text at the current cursor position
function insertSnippetAtCursor(text) {
  const activeElement = document.activeElement;
  
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    const value = activeElement.value;
    
    // Insert the snippet text
    activeElement.value = value.substring(0, start) + text + value.substring(end);
    
    // Set cursor position after the inserted text
    activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
    
    // Trigger input event to notify the page of the change
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    activeElement.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Show a brief visual feedback
    showInsertionFeedback(activeElement);
  } else {
    // If no active element, try to find the last focused input
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea');
    if (inputs.length > 0) {
      const lastInput = inputs[inputs.length - 1];
      lastInput.focus();
      lastInput.value += text;
      lastInput.dispatchEvent(new Event('input', { bubbles: true }));
      lastInput.dispatchEvent(new Event('change', { bubbles: true }));
      showInsertionFeedback(lastInput);
    }
  }
}

// Show visual feedback when snippet is inserted
function showInsertionFeedback(element) {
  // Create a temporary highlight effect
  const originalBackground = element.style.backgroundColor;
  element.style.backgroundColor = '#e8f5e8';
  element.style.transition = 'background-color 0.3s ease';
  
  setTimeout(() => {
    element.style.backgroundColor = originalBackground;
  }, 300);
}

// Future enhancement: Add keyboard shortcuts
document.addEventListener('keydown', (event) => {
  // Ctrl+Shift+M to open snippet selector (future feature)
  if (event.ctrlKey && event.shiftKey && event.key === 'M') {
    event.preventDefault();
    chrome.runtime.sendMessage({ action: 'openSnippetSelector' });
  }
});

// Listen for focus events to track the active input
let lastFocusedElement = null;

document.addEventListener('focusin', (event) => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    lastFocusedElement = event.target;
  }
});

// Handle paste events to detect if user is pasting
document.addEventListener('paste', (event) => {
  // This could be used for future features like snippet suggestions
}); 