'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, friendlyError, isConfigured } from '@/lib/supabase'
import { fetchProfileById } from '@/lib/api'
import type { Profile } from '@/lib/types'

/**
 * Ported from the existing app unchanged in behaviour: same session handling,
 * same profile retry (the profile row is created by a database trigger and can
 * lag the first render), same role rules.
 */
interface AuthValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isModerator: boolean
  signUp: (input: {
    email: string
    password: string
    username: string
    displayName?: string
  }) => Promise<{ needsConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const found = await fetchProfileById(userId)
      if (found) {
        setProfile(found)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
    }
    setProfile(null)
  }, [])

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }

    let cancelled = false

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        setSession(data.session)
        if (data.session?.user) {
          loadProfile(data.session.user.id).finally(() => {
            if (!cancelled) setLoading(false)
          })
        } else {
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = useCallback<AuthValue['signUp']>(
    async ({ email, password, username, displayName }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim().toLowerCase(),
            display_name: displayName?.trim() || username.trim(),
          },
          emailRedirectTo:
            typeof window === 'undefined' ? undefined : window.location.origin,
        },
      })
      if (error) throw new Error(friendlyError(error))
      return { needsConfirmation: !data.session }
    },
    [],
  )

  const signIn = useCallback<AuthValue['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw new Error(friendlyError(error))
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id)
  }, [session, loadProfile])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isModerator: Boolean(
        profile &&
          !profile.is_banned &&
          (profile.role === 'moderator' || profile.role === 'admin'),
      ),
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signUp, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
