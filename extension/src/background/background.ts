// Background service worker for Chrome extension

const API_BASE_URL = 'https://getdealmetrics.com'
// Public Supabase credentials (used only for token refresh)
const SUPABASE_URL = 'https://zgysztqjsocznebtojbr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpneXN6dHFqc29jem5lYnRvamJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzAzNjUsImV4cCI6MjA4NDkwNjM2NX0.O5VqCpiygA2UAX6Oyv5TzWzYP9JLJvts6MSfBmLXKZY'

chrome.runtime.onInstalled.addListener(() => {
  console.log('DealMetrics extension installed')
})

// Open dashboard when extension icon is clicked (no popup)
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: `${API_BASE_URL}/dashboard` })
})

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveDeal') {
    handleSaveDeal(request.payload, request.authToken)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }))
    return true
  }
  if (request.action === 'getValidToken') {
    getValidToken()
      .then(token => sendResponse({ token }))
      .catch(() => sendResponse({ token: null }))
    return true
  }
  return false
})

/** Decode JWT payload without verification (only to read exp). */
function jwtExp(jwt: string): number | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

/** Refresh access token using Supabase auth. Returns new access_token and stores tokens. */
async function refreshAccessToken(): Promise<string> {
  const { refreshToken } = await chrome.storage.sync.get(['refreshToken'])
  if (!refreshToken) throw new Error('No refresh token stored')
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.msg || err.error_description || 'Token refresh failed')
  }
  const data = await res.json()
  const access = data.access_token
  const refresh = data.refresh_token
  if (!access) throw new Error('No access token in refresh response')
  await chrome.storage.sync.set({
    authToken: access,
    ...(refresh && { refreshToken: refresh }),
  })
  return access
}

/** Return a valid access token, refreshing if expired or expiring within 5 minutes. */
async function getValidToken(): Promise<string | null> {
  const { authToken, refreshToken } = await chrome.storage.sync.get(['authToken', 'refreshToken'])
  if (!authToken) return null
  const exp = jwtExp(authToken)
  const nowSec = Math.floor(Date.now() / 1000)
  const bufferSec = 5 * 60 // refresh if expiring in 5 min
  if (exp != null && exp > nowSec + bufferSec) return authToken
  if (!refreshToken) return authToken // use existing token and let API return 401 if expired
  try {
    return await refreshAccessToken()
  } catch (e) {
    console.error('[DealMetrics BG] Token refresh failed:', e)
    return authToken
  }
}

async function handleSaveDeal(payload: any, authTokenFromContent: string): Promise<any> {
  const authToken = await getValidToken().then(t => t ?? authTokenFromContent)
  console.log('[DealMetrics BG] Saving deal to API...', { hasToken: !!authToken })
  const response = await fetch(`${API_BASE_URL}/api/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  })
  if (response.status === 401) {
    await chrome.storage.sync.remove(['authToken', 'refreshToken', 'userEmail'])
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Invalid or expired token')
  }
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
