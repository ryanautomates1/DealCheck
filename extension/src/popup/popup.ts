const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://getdealmetrics.com'

interface ImportPayload {
  zillowUrl: string
  extractedData: Record<string, any>
  importedFields: string[]
  missingFields: string[]
  extractorVersion: string
  purchaseType: string
  downPaymentPct: number
}

interface AuthState {
  authToken: string | null
  userEmail: string | null
}

let currentAuth: AuthState = {
  authToken: null,
  userEmail: null
}

// Load auth state from storage
async function loadAuthState(): Promise<AuthState> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['authToken', 'userEmail'], (result) => {
      resolve({
        authToken: result.authToken || null,
        userEmail: result.userEmail || null
      })
    })
  })
}

// Clear auth state
async function clearAuthState(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.remove(['authToken', 'userEmail'], () => {
      resolve()
    })
  })
}

// Update UI based on auth state
function updateAuthUI(isAuthenticated: boolean, email?: string | null) {
  const authSection = document.getElementById('auth-section')!
  const authStatus = document.getElementById('auth-status')!
  const signedOutState = document.getElementById('signed-out-state')!
  const signedInState = document.getElementById('signed-in-state')!
  const userEmailEl = document.getElementById('user-email')!
  const importBtn = document.getElementById('import-btn') as HTMLButtonElement

  if (isAuthenticated && email) {
    authSection.className = 'auth-section connected'
    authStatus.textContent = 'Connected'
    authStatus.className = 'auth-status connected'
    signedOutState.classList.add('hidden')
    signedInState.classList.remove('hidden')
    userEmailEl.textContent = email
    importBtn.disabled = false
  } else {
    authSection.className = 'auth-section'
    authStatus.textContent = 'Not connected'
    authStatus.className = 'auth-status disconnected'
    signedOutState.classList.remove('hidden')
    signedInState.classList.add('hidden')
    userEmailEl.textContent = ''
    importBtn.disabled = false // Still allow clicking to show error message
  }
}

// Handle sign in - open auth page
function handleSignIn() {
  const authUrl = `${API_BASE_URL}/auth/extension`
  chrome.tabs.create({ url: authUrl })
}

// Handle sign out
async function handleSignOut() {
  await clearAuthState()
  currentAuth = { authToken: null, userEmail: null }
  updateAuthUI(false)
  
  const statusEl = document.getElementById('status')!
  statusEl.textContent = 'Signed out successfully'
  setTimeout(() => {
    statusEl.textContent = ''
  }, 2000)
}

async function importListing() {
  const statusEl = document.getElementById('status')!
  const errorEl = document.getElementById('error')!
  const buttonEl = document.getElementById('import-btn') as HTMLButtonElement
  const purchaseTypeEl = document.getElementById('purchase-type') as HTMLSelectElement
  const downPaymentEl = document.getElementById('down-payment') as HTMLInputElement

  // Check for auth token
  if (!currentAuth.authToken) {
    errorEl.textContent = 'Please sign in first to import listings.'
    return
  }

  // Validate inputs
  const purchaseType = purchaseTypeEl.value
  const downPaymentPct = parseFloat(downPaymentEl.value)

  if (!purchaseType) {
    errorEl.textContent = 'Please select a Purchase Type'
    return
  }

  if (isNaN(downPaymentPct) || downPaymentPct < 0 || downPaymentPct > 100) {
    errorEl.textContent = 'Please enter a valid Down Payment % (0-100)'
    return
  }

  statusEl.textContent = 'Extracting data...'
  errorEl.textContent = ''
  buttonEl.disabled = true

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab.id) {
      throw new Error('Could not access current tab')
    }

    // Check if we're on Zillow
    if (!tab.url?.includes('zillow.com')) {
      errorEl.textContent = 'Please navigate to a property listing page first.'
      statusEl.textContent = ''
      buttonEl.disabled = false
      return
    }

    // Use message passing to content script (already injected via manifest)
    let response
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' })
    } catch (error: any) {
      // Content script might not be loaded yet, try injecting it
      if (error.message?.includes('Could not establish connection')) {
        throw new Error('Content script not loaded. Please refresh the page and try again.')
      }
      throw error
    }

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to extract data')
    }

    const payload: ImportPayload = {
      ...response.payload,
      purchaseType,
      downPaymentPct,
    }

    statusEl.textContent = 'Importing to DealMetrics...'

    console.log('Sending payload to:', `${API_BASE_URL}/api/import`)
    console.log('Payload:', payload)

    // POST to web app with auth token
    const apiResponse = await fetch(`${API_BASE_URL}/api/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAuth.authToken}`,
      },
      body: JSON.stringify(payload),
    })

    console.log('API Response status:', apiResponse.status, apiResponse.statusText)

    if (!apiResponse.ok) {
      // Check if response is JSON
      const contentType = apiResponse.headers.get('content-type')
      let errorMessage = 'Failed to import listing'
      let isLimitError = false

      if (contentType && contentType.includes('application/json')) {
        try {
          const errorData = await apiResponse.json()
          console.log('Error response data:', errorData)
          
          // Include step info if available for debugging
          const stepInfo = errorData.step ? ` [step: ${errorData.step}]` : ''
          errorMessage = (errorData.error || errorData.message || errorMessage) + stepInfo

          // Check for import limit error
          if (apiResponse.status === 403 && errorData.upgradeUrl) {
            isLimitError = true
            errorMessage = errorData.message || 'Monthly import limit reached. Upgrade to Pro for unlimited imports.'
          }

          // Check for unauthorized or invalid token
          if (apiResponse.status === 401) {
            errorMessage = `Session expired: ${errorData.error || 'Please sign in again.'}${stepInfo}`
            // Clear invalid auth
            await clearAuthState()
            currentAuth = { authToken: null, userEmail: null }
            updateAuthUI(false)
          }
          
          // Check for profile not found
          if (apiResponse.status === 404 && errorData.error?.includes('Profile not found')) {
            errorMessage = 'Account setup incomplete. Please visit the website to complete setup.'
          }
        } catch (e) {
          // If JSON parsing fails, use default message
          errorMessage = `Server error (${apiResponse.status}): ${apiResponse.statusText}`
        }
      } else {
        // Response is HTML or other non-JSON format
        const text = await apiResponse.text()
        errorMessage = `Server error (${apiResponse.status}): ${apiResponse.statusText}. Please check that the web app is running.`
        console.error('Non-JSON error response:', text.substring(0, 200))
      }

      // For limit errors, show upgrade option
      if (isLimitError) {
        const upgradeEl = document.getElementById('upgrade-prompt')
        if (upgradeEl) {
          upgradeEl.classList.remove('hidden')
        }
      }

      throw new Error(errorMessage)
    }

    const { dealId } = await apiResponse.json()

    statusEl.textContent = 'Success! Opening deal...'

    // Open deal page
    const dealUrl = `${API_BASE_URL}/deals/${dealId}`
    await chrome.tabs.create({ url: dealUrl })

    // Close popup after a short delay
    setTimeout(() => {
      window.close()
    }, 500)
  } catch (error: any) {
    console.error('Import error:', error)
    errorEl.textContent = error.message || 'Could not import listing. You can still create a deal manually.'
    statusEl.textContent = ''
    buttonEl.disabled = false
  }
}

// Listen for auth completion messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'authComplete') {
    // Reload auth state and update UI
    loadAuthState().then((auth) => {
      currentAuth = auth
      updateAuthUI(!!auth.authToken, auth.userEmail)
    })
  }
})

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load auth state
  currentAuth = await loadAuthState()
  updateAuthUI(!!currentAuth.authToken, currentAuth.userEmail)

  // Set up event listeners
  const importBtn = document.getElementById('import-btn')
  importBtn?.addEventListener('click', importListing)

  const signInBtn = document.getElementById('sign-in-btn')
  signInBtn?.addEventListener('click', handleSignIn)

  const signOutBtn = document.getElementById('sign-out-btn')
  signOutBtn?.addEventListener('click', handleSignOut)
})
