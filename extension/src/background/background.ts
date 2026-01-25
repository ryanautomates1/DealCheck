// Background service worker for Chrome extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('DealMetrics extension installed')
})

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    // Forward to content script (handled in content.ts)
    // This is a placeholder - actual extraction happens in content script
    return true
  }
})
