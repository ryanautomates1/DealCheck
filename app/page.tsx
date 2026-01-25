'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const useSupabase = process.env.USE_SUPABASE === 'true'
    
    if (supabaseUrl && useSupabase) {
      // Using Supabase - redirect to login (middleware will handle auth check)
      router.push('/auth/login')
    } else {
      // Local dev mode - go straight to dashboard
      router.push('/dashboard')
    }
  }, [router])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">DealCheck</h1>
        <p className="text-blue-200">Loading...</p>
      </div>
    </div>
  )
}
