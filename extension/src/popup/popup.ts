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

async function importListing() {
  const statusEl = document.getElementById('status')!
  const errorEl = document.getElementById('error')!
  const buttonEl = document.getElementById('import-btn') as HTMLButtonElement
  const purchaseTypeEl = document.getElementById('purchase-type') as HTMLSelectElement
  const downPaymentEl = document.getElementById('down-payment') as HTMLInputElement
  
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
    
    // POST to web app
    const apiResponse = await fetch(`${API_BASE_URL}/api/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
          errorMessage = errorData.error || errorData.message || errorMessage
          
          // Check for import limit error
          if (apiResponse.status === 403 && errorData.upgradeUrl) {
            isLimitError = true
            errorMessage = errorData.message || 'Monthly import limit reached. Upgrade to Pro for unlimited imports.'
          }
          
          // Check for unauthorized
          if (apiResponse.status === 401) {
            errorMessage = 'Please sign in to DealMetrics first.'
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

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  const importBtn = document.getElementById('import-btn')
  importBtn?.addEventListener('click', importListing)
})
