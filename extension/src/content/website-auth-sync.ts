/**
 * Content script that runs on getdealmetrics.com (and localhost) to sync auth
 * between the website and the extension:
 * - When the page has no session, it can request the extension's session and set it on the site.
 * - When the user signs in on the website, we store tokens in the extension.
 * - When the user signs out on the website, we clear the extension's stored tokens.
 * - Sets a global so the website can hide the "Get the extension" CTA when installed.
 */

declare global {
  interface Window {
    __DEALMETRICS_EXTENSION_INSTALLED__?: boolean
  }
}

;(function () {
  try {
    window.__DEALMETRICS_EXTENSION_INSTALLED__ = true
  } catch {}
})()

const ALLOWED_ORIGINS = [
  'https://getdealmetrics.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some((allowed) => origin === allowed || origin.startsWith(allowed + ':'))
}

function handleMessage(event: MessageEvent) {
  if (event.source !== window || !event.data || typeof event.data !== 'object') return
  const origin = event.origin
  if (!isAllowedOrigin(origin)) return

  const { type, access_token, refresh_token, email } = event.data as {
    type?: string
    access_token?: string
    refresh_token?: string
    email?: string
  }

  if (type === 'DEALMETRICS_REQUEST_EXTENSION_SESSION') {
    chrome.storage.sync.get(['authToken', 'refreshToken', 'userEmail'], (items) => {
      if (items.authToken) {
        window.postMessage(
          {
            type: 'DEALMETRICS_EXTENSION_HAS_SESSION',
            access_token: items.authToken,
            refresh_token: items.refreshToken || '',
            email: items.userEmail || '',
          },
          origin
        )
      }
    })
    return
  }

  if (type === 'DEALMETRICS_WEB_SIGNED_IN' && access_token) {
    chrome.storage.sync.set({
      authToken: access_token,
      refreshToken: refresh_token || '',
      userEmail: email || '',
    })
    return
  }

  if (type === 'DEALMETRICS_SIGN_OUT') {
    chrome.storage.sync.remove(['authToken', 'refreshToken', 'userEmail'])
  }
}

window.addEventListener('message', handleMessage)
