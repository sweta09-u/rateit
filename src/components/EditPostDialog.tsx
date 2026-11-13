'use client'

import { useState } from 'react'
import { Modal } from './ui/Modal'
import { ImagePicker } from './ImagePicker'
import { CATEGORIES, LIMITS } from '@/lib/constants'
import { hasErrors, validatePost, type Errors } from '@/lib/validate'
import { updatePost } from '@/lib/api'
import { friendlyError } from '@/lib/supabase'
import { cx } from '@/lib/format'
import type { Category, PostDetail } from '@/lib/types'

export interface PostEditValues {
  title: string
  body: string
  category: Category
  link_url: string
  image_url: string
}

/** Edit your own post. Same validation and same updatePost call as before. */
export function EditPostDialog({
  post,
  userId,
  onClose,
  onSaved,
}: {
  post: PostDetail
  userId: string
  onClose: () => void
  onSaved: (values: PostEditValues) => void
}) {
  const [values, setValues] = useState<PostEditValues>({
    title: post.title,
    body: post.body,
    category: post.category,
    link_url: post.link_url ?? '',
    image_url: post.image_url ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = <K extends keyof PostEditValues>(key: K, value: PostEditValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  async function save() {
    const found = validatePost(values)
    setErrors(found)
    if (hasErrors(found)) return
    setBusy(true)
    setError(null)
    try {
      await updatePost(post.id, {
        title: values.title.trim(),
        body: values.body.trim(),
        category: values.category,
        link_url: values.link_url.trim() || null,
        image_url: values.image_url.trim() || null,
      })
      onSaved(values)
      onClose()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const field =
    'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'

  return (
    <Modal
      open
      title="Edit post"
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Title</span>
          <input
            value={values.title}
            onChange={(e) => update('title', e.target.value)}
            maxLength={LIMITS.titleMax}
            className={field}
          />
          {errors.title && (
            <span className="text-xs" style={{ color: 'var(--neg)' }}>
              {errors.title}
            </span>
          )}
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Category</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => update('category', option)}
                aria-pressed={values.category === option}
                className={cx(
                  'rounded-lg px-2.5 py-1.5 text-sm',
                  values.category === option
                    ? 'bg-brand font-semibold text-brand-fg'
                    : 'bg-surface2 font-medium text-fg hover:bg-surface',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Body</span>
          <textarea
            value={values.body}
            onChange={(e) => update('body', e.target.value)}
            rows={6}
            maxLength={LIMITS.bodyMax}
            className={cx(field, 'resize-y')}
          />
          {errors.body && (
            <span className="text-xs" style={{ color: 'var(--neg)' }}>
              {errors.body}
            </span>
          )}
        </label>

        <ImagePicker
          label="Image"
          value={values.image_url || null}
          onChange={(url) => update('image_url', url ?? '')}
          userId={userId}
          kind="posts"
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Link</span>
          <input
            type="url"
            value={values.link_url}
            onChange={(e) => update('link_url', e.target.value)}
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
      </div>
    </Modal>
  )
}
