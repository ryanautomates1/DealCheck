'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    // Always redirect to dashboard - middleware will handle auth if Supabase is enabled
    router.push('/dashboard')
  }, [router])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">DealMetrics</h1>
        <p className="text-blue-200">Loading...</p>
      </div>
    </div>
  )
}
