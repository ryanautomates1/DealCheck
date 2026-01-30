'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const AUTH_SYNC_ORIGINS = ['https://getdealmetrics.com', 'http://localhost:3000', 'http://127.0.0.1:3000']
function isAuthSyncOrigin(origin: string): boolean {
  return AUTH_SYNC_ORIGINS.some((o) => origin === o || origin.startsWith(o + ':'))
}

interface UserProfile {
  id: string
  email: string
  subscription_tier: 'free' | 'pro'
  imports_this_month: number
  imports_reset_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const extensionSessionRequested = useRef(false)
  const handlingExtensionSession = useRef(false)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      return data as UserProfile
    } catch (err) {
      console.error('Error fetching profile:', err)
      return null
    }
  }

  const refreshProfile = async () => {
    if (user) {
      const newProfile = await fetchProfile(user.id)
      setProfile(newProfile)
    }
  }

  useEffect(() => {
    // Check if we're using Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL === undefined) {
      // Not using Supabase - set mock user for local dev
      setUser(null)
      setProfile(null)
      setLoading(false)
      return
    }

    // Listen for extension session (extension has tokens; we don't have a session yet)
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data || typeof event.data !== 'object') return
      if (!isAuthSyncOrigin(event.origin)) return
      if (event.data?.type !== 'DEALMETRICS_EXTENSION_HAS_SESSION') return
      if (handlingExtensionSession.current) return
      const { access_token, refresh_token } = event.data as { access_token?: string; refresh_token?: string }
      if (!access_token) return
      if (!extensionSessionRequested.current) return
      handlingExtensionSession.current = true
      try {
        await supabase.auth.setSession({ access_token, refresh_token: refresh_token || '' })
        // onAuthStateChange will set user/profile
      } catch (_) {
        // ignore
      } finally {
        handlingExtensionSession.current = false
        extensionSessionRequested.current = false
      }
    }
    window.addEventListener('message', handleMessage)

    // Get initial session
    supabase.auth.getSession().then(async (result: { data: { session: Session | null }; error: any }) => {
      const session = result.data.session
      if (session?.user) {
        extensionSessionRequested.current = false
        setUser(session.user)
        const userProfile = await fetchProfile(session.user.id)
        setProfile(userProfile)
      } else {
        setUser(null)
        setProfile(null)
        extensionSessionRequested.current = true
        window.postMessage({ type: 'DEALMETRICS_REQUEST_EXTENSION_SESSION' }, window.location.origin)
        // Retry once after delay so extension content script has time to load
        setTimeout(() => {
          if (extensionSessionRequested.current) {
            window.postMessage({ type: 'DEALMETRICS_REQUEST_EXTENSION_SESSION' }, window.location.origin)
          }
        }, 600)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        extensionSessionRequested.current = false
        const userProfile = await fetchProfile(session.user.id)
        setProfile(userProfile)
        // Sync tokens to extension so Zillow sidebar sees the same user
        window.postMessage(
          {
            type: 'DEALMETRICS_WEB_SIGNED_IN',
            access_token: session.access_token,
            refresh_token: session.refresh_token || '',
            email: session.user?.email || '',
          },
          window.location.origin
        )
      } else {
        setProfile(null)
      }

      if (event === 'SIGNED_OUT') {
        router.push('/auth/login')
      }
    })

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  const signOut = async () => {
    setUser(null)
    setProfile(null)
    window.postMessage({ type: 'DEALMETRICS_SIGN_OUT' }, window.location.origin)
    try {
      // Server-side signout clears auth cookies via response Set-Cookie; next load will have no session
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' })
    } catch (_) {
      // Continue to redirect even if request fails
    }
    // Full page redirect so next request sends no auth cookies
    window.location.href = '/auth/login'
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
