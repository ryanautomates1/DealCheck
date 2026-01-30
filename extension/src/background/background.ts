// Background service worker for Chrome extension

const API_BASE_URL = 'https://getdealmetrics.com'

chrome.runtime.onInstalled.addListener(() => {
  console.log('DealMetrics extension installed')
})

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle API calls from content script (to avoid CORS issues)
  if (request.action === 'saveDeal') {
    handleSaveDeal(request.payload, request.authToken)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true // Keep channel open for async response
  }
  
  return false
})

// Make API call to save deal
async function handleSaveDeal(payload: any, authToken: string): Promise<any> {
  console.log('[DealMetrics BG] Saving deal to API...', { hasToken: !!authToken, tokenLength: authToken?.length })
  
  const response = await fetch(`${API_BASE_URL}/api/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  })
  
  console.log('[DealMetrics BG] API response status:', response.status)
  
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    console.error('[DealMetrics BG] API error:', data)
    throw new Error(data.error || `HTTP ${response.status}`)
  }
  
  const result = await response.json()
  console.log('[DealMetrics BG] API success:', result)
  return result
}
