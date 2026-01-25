'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'transferring' | 'success' | 'error'>('transferring')
  
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  useEffect(() => {
    // The content script will read the token from the data attribute
    // and store it in chrome.storage.sync
    
    // Give the content script time to capture the token
    const timer = setTimeout(() => {
      setStatus('success')
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Connection Failed</h1>
          <p className="text-blue-200 mb-6">No authentication token was provided. Please try signing in again.</p>
          <a 
            href="/auth/extension" 
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Try Again
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
      {/* Hidden element for content script to read */}
      <div 
        id="extension-auth-data" 
        data-token={token} 
        data-email={email || ''} 
        style={{ display: 'none' }}
      />
      
      <div className="max-w-md w-full text-center">
        {status === 'transferring' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-6 animate-pulse">
              <svg className="w-8 h-8 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Connecting Extension...</h1>
            <p className="text-blue-200">Transferring your credentials to the extension.</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Extension Connected!</h1>
            <p className="text-blue-200 mb-2">
              {email && <>Signed in as <span className="font-medium text-white">{email}</span></>}
            </p>
            <p className="text-blue-200 mb-6">
              You can now close this tab and return to the extension to import listings.
            </p>
            <div className="p-4 bg-white/10 rounded-lg backdrop-blur">
              <p className="text-sm text-blue-100">
                Click the DealMetrics extension icon in your browser toolbar to start importing properties from Zillow.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ExtensionSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
