import { extractZillowData } from './extractors'
import { injectFloatingButton, updateButtonState, isZillowListingPage } from './floating-button'
import { toggleSidebar, isSidebarOpen, closeSidebar } from './sidebar'

// State
let floatingButton: HTMLElement | null = null

// Initialize floating button on listing pages
function initFloatingButton(): void {
  if (!isZillowListingPage()) return
  
  floatingButton = injectFloatingButton(() => {
    toggleSidebar()
    if (floatingButton) {
      updateButtonState(floatingButton, isSidebarOpen())
    }
  })
}

// Watch for URL changes (Zillow uses client-side navigation)
let lastUrl = window.location.href
function watchUrlChanges(): void {
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      
      // Close sidebar on navigation
      closeSidebar()
      
      // Re-check if we should show button
      if (floatingButton) {
        floatingButton.remove()
        floatingButton = null
      }
      
      // Delay to let page render
      setTimeout(initFloatingButton, 1000)
    }
  })
  
  observer.observe(document.body, { childList: true, subtree: true })
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initFloatingButton()
    watchUrlChanges()
  })
} else {
  initFloatingButton()
  watchUrlChanges()
}

// Listen for messages from popup (keep existing functionality)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    try {
      // Check if we're on a Zillow listing page
      if (!window.location.hostname.includes('zillow.com')) {
        sendResponse({
          success: false,
          error: 'Not on a Zillow page',
        })
        return true
      }
      
      // Extract data
      const result = extractZillowData()
      
      // Prepare payload with confidence scores
      const extractedData: Record<string, any> = {}
      const importedFields: string[] = []
      const fieldConfidences: Record<string, number> = {}
      
      for (const [key, field] of Object.entries(result.fields)) {
        if (field.value !== undefined && field.value !== null) {
          extractedData[key] = field.value
          importedFields.push(key)
          fieldConfidences[key] = field.confidence
        }
      }
      
      const missingFields: string[] = []
      const requiredFields = ['address', 'listPrice', 'beds', 'baths', 'sqft']
      for (const field of requiredFields) {
        if (!importedFields.includes(field)) {
          missingFields.push(field)
        }
      }
      
      sendResponse({
        success: true,
        payload: {
          zillowUrl: window.location.href,
          extractedData,
          importedFields,
          missingFields,
          fieldConfidences,
          extractorVersion: result.extractorVersion,
        },
      })
    } catch (error: any) {
      sendResponse({
        success: false,
        error: error.message || 'Extraction failed',
      })
    }
    
    return true // Keep channel open for async response
  }
  
  // Handle sidebar toggle from popup
  if (request.action === 'toggleSidebar') {
    toggleSidebar()
    if (floatingButton) {
      updateButtonState(floatingButton, isSidebarOpen())
    }
    sendResponse({ success: true, isOpen: isSidebarOpen() })
    return true
  }
})
