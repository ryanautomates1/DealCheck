// Auth content script - runs on the extension success page
// Captures the auth token and stores it in chrome.storage.sync

function captureAuthToken() {
  const authDataEl = document.getElementById('extension-auth-data')
  
  if (!authDataEl) {
    console.log('[DealMetrics] No auth data element found')
    return
  }

  const token = authDataEl.dataset.token
  const email = authDataEl.dataset.email

  if (!token) {
    console.log('[DealMetrics] No token in auth data')
    return
  }

  console.log('[DealMetrics] Auth token captured, storing...')

  // Store the token and email in chrome.storage.sync
  chrome.storage.sync.set({ 
    authToken: token,
    userEmail: email || ''
  }, () => {
    console.log('[DealMetrics] Auth token stored successfully')
    
    // Notify any open popups that auth was successful
    chrome.runtime.sendMessage({ 
      action: 'authComplete', 
      email: email 
    }).catch(() => {
      // Popup might not be open, that's fine
    })
  })
}

// Run immediately when script loads
captureAuthToken()

// Also observe for dynamic content (in case React hydrates after script runs)
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      const authDataEl = document.getElementById('extension-auth-data')
      if (authDataEl && authDataEl.dataset.token) {
        captureAuthToken()
        observer.disconnect()
        break
      }
    }
  }
})

observer.observe(document.body, { childList: true, subtree: true })

// Disconnect observer after 5 seconds to prevent memory leaks
setTimeout(() => observer.disconnect(), 5000)
