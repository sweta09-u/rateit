'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Monitor, Moon, Sun } from 'lucide-react'
import { deleteOwnAccount, updateProfile } from '@/lib/api'
import { LIMITS } from '@/lib/constants'
import { friendlyError } from '@/lib/supabase'
import { cx } from '@/lib/format'
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  type ThemeChoice,
} from '@/lib/theme'
import { useAuth } from '@/context/AuthContext'
import { ImagePicker } from '@/components/ImagePicker'

const THEMES: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user, profile, loading, refreshProfile, signOut } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemeChoice>('dark')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setTheme(readStoredTheme())
  }, [])

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setBio(profile.bio ?? '')
      setAvatarUrl(profile.avatar_url ?? '')
    }
  }, [profile])

  function chooseTheme(next: ThemeChoice) {
    setTheme(next)
    storeTheme(next)
    applyTheme(resolveTheme(next))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateProfile(user.id, {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      await refreshProfile()
      setSaved(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  async function removeAccount() {
    setDeleting(true)
    try {
      await deleteOwnAccount()
      await signOut()
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(friendlyError(err))
      setDeleting(false)
    }
  }

  if (loading || !user || !profile) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </div>
    )
  }

  const field =
    'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <Link href={`/u/${profile.username}`} className="text-sm font-medium text-muted hover:text-fg">
          View profile
        </Link>
      </div>

      <form onSubmit={save} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Your profile</h2>

        <div className="flex items-center gap-3 rounded-xl border border-line bg-bg/40 p-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-brand text-sm font-bold text-brand-fg">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              profile.username.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{displayName || profile.username}</p>
            <p className="text-xs text-muted">@{profile.username}</p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={LIMITS.displayNameMax}
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={LIMITS.bioMax}
            className={cx(field, 'resize-y')}
          />
          <span className="text-right text-xs text-muted">
            {bio.length}/{LIMITS.bioMax}
          </span>
        </label>

        <ImagePicker
          label="Profile photo"
          value={avatarUrl || null}
          onChange={(url) => setAvatarUrl(url ?? '')}
          userId={user.id}
          kind="avatars"
          shape="circle"
          hint="Uploaded from your device. Square images look best."
        />

        {error && (
          <p role="alert" className="text-sm font-medium" style={{ color: 'var(--neg)' }}>
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm font-medium text-brand">
            Saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Appearance</h2>
        <p className="mt-0.5 text-sm text-muted">
          {theme === 'system'
            ? `Following your device, currently ${resolveTheme('system')}.`
            : `Always ${theme}, whatever your device is set to.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Colour theme">
          {THEMES.map(({ value, label, Icon }) => {
            const active = theme === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => chooseTheme(value)}
                className={cx(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-brand font-semibold text-brand-fg'
                    : 'border border-line font-medium text-fg hover:bg-surface2',
                )}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: 'color-mix(in srgb, var(--neg) 35%, transparent)' }}>
        <h2 className="text-base font-semibold">Delete your account</h2>
        <p className="mt-0.5 text-sm text-muted">
          This removes your profile, posts, ratings and comments. It cannot be undone.
        </p>
        {confirmDelete ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void removeAccount()}
              disabled={deleting}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--neg)' }}
            >
              {deleting ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface2"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold"
            style={{ borderColor: 'color-mix(in srgb, var(--neg) 45%, transparent)', color: 'var(--neg)' }}
          >
            Delete account
          </button>
        )}
      </div>
    </div>
  )
}
