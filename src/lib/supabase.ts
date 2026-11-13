import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined

/** The names of whatever is missing, so the setup screen can say precisely what to add. */
export const missingConfig: string[] = [
  !url && 'NEXT_PUBLIC_SUPABASE_URL',
  !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
].filter(Boolean) as string[]

/**
 * True when both environment values are present. The app shows a setup screen
 * instead of crashing when they are missing.
 *
 * Next inlines NEXT_PUBLIC_* at BUILD time, so these must be set before the
 * build runs — adding them afterwards requires a rebuild, not just a restart.
 */
export const isConfigured = missingConfig.length === 0

if (!isConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    `[RateIt] Supabase is not configured. Missing: ${missingConfig.join(', ')}. ` +
      'Set them in the host environment (or .env.local) and rebuild.',
  )
}

/**
 * The browser client. It carries only the anon key, so every request is
 * subject to the Row Level Security policies in supabase/migrations.
 * The service-role key must never appear in this file or anywhere else
 * that ships to a browser.
 */
export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

/** Turn a PostgREST error into a message worth showing a person. */
export function friendlyError(error: unknown): string {
  const message =
    typeof error === 'string'
      ? error
      : ((error as { message?: string })?.message ?? 'Something went wrong.')

  // Database constraints and triggers raise readable messages; surface them.
  if (/row-level security/i.test(message)) {
    return 'You do not have permission to do that.'
  }
  if (/duplicate key|unique constraint/i.test(message)) {
    return 'That already exists.'
  }
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password combination was not found.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email address before signing in.'
  }
  if (/user already registered/i.test(message)) {
    return 'An account with that email already exists.'
  }
  return message
}
