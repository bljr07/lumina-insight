// Background service worker for Lumina Insight
// This runs in the background and handles events.

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Lumina Insight installed!', details.reason);
});

// Example: listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);

  if (message.type === 'GREET') {
    sendResponse({ greeting: 'Hello from the background!' });
  }

  // Return true to indicate async response (if needed)
  return true;
});
