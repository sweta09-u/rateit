'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPost } from '@/lib/api'
import { CATEGORIES, LIMITS } from '@/lib/constants'
import { validatePost, hasErrors, type Errors } from '@/lib/validate'
import { friendlyError } from '@/lib/supabase'
import { cx } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { ImagePicker } from '@/components/ImagePicker'
import type { Category } from '@/lib/types'

export default function NewPostPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<Category>('Opinion')
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const input = { title, body, category, link_url: linkUrl, image_url: imageUrl }
    const found = validatePost(input)
    setErrors(found)
    if (hasErrors(found)) return

    setBusy(true)
    try {
      const post = await createPost({
        title: title.trim(),
        body: body.trim(),
        category,
        link_url: linkUrl.trim() || null,
        image_url: imageUrl.trim() || null,
      })
      router.push(`/post/${post.id}`)
      router.refresh()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </div>
    )
  }

  const field =
    'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create a post</h1>
          <p className="mt-0.5 text-sm text-muted">
            Post anything. The community rates it from −5 to +10.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-muted hover:text-fg">
          Cancel
        </Link>
      </div>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-5" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.titleMax}
            placeholder="What is it?"
            aria-invalid={Boolean(errors.title)}
            className={field}
          />
          <span className="flex justify-between text-xs text-muted">
            <span style={{ color: errors.title ? 'var(--neg)' : undefined }}>{errors.title}</span>
            <span>
              {title.length}/{LIMITS.titleMax}
            </span>
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-fg">Category</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                aria-pressed={category === option}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-sm transition-colors',
                  category === option
                    ? 'bg-brand font-semibold text-brand-fg'
                    : 'bg-surface font-medium text-fg hover:bg-surface2',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            maxLength={LIMITS.bodyMax}
            placeholder="Say something worth rating…"
            aria-invalid={Boolean(errors.body)}
            className={cx(field, 'resize-y')}
          />
          <span className="flex justify-between text-xs text-muted">
            <span style={{ color: errors.body ? 'var(--neg)' : undefined }}>{errors.body}</span>
            <span>
              {body.length}/{LIMITS.bodyMax}
            </span>
          </span>
        </label>

        <ImagePicker
          label="Image (optional)"
          value={imageUrl || null}
          onChange={(url) => setImageUrl(url ?? '')}
          userId={user.id}
          kind="posts"
          hint="Uploaded from your device and shown on the post."
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">
            Link <span className="font-normal text-muted">(optional)</span>
          </span>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            aria-invalid={Boolean(errors.link_url)}
            className={field}
          />
          {errors.link_url && (
            <span className="text-xs" style={{ color: 'var(--neg)' }}>
              {errors.link_url}
            </span>
          )}
        </label>

        {error && (
          <p role="alert" className="text-sm font-medium" style={{ color: 'var(--neg)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60"
        >
          {busy ? 'Publishing…' : 'Publish'}
        </button>
      </form>
    </div>
  )
}
