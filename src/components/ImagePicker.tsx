'use client'

import { useId, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react'
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '@/lib/constants'
import { uploadImage } from '@/lib/api'
import { friendlyError } from '@/lib/supabase'
import { cx } from '@/lib/format'
import { CameraCapture } from './CameraCapture'

const MAX_MB = Math.round(IMAGE_MAX_BYTES / 1024 / 1024)

/**
 * Add an image two ways, as in the existing app: the native camera on a phone,
 * a live camera preview on desktop, or the ordinary file picker. Either route
 * ends up in `uploadImage`, so validation and the storage path are unchanged.
 */
export function ImagePicker({
  label,
  hint,
  value,
  onChange,
  userId,
  kind,
  shape = 'wide',
  disabled = false,
}: {
  label: string
  hint?: string
  value: string | null
  onChange: (url: string | null) => void
  userId: string
  kind: 'posts' | 'avatars'
  shape?: 'wide' | 'circle'
  disabled?: boolean
}) {
  const labelId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)

  async function upload(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      onChange(await uploadImage(file, userId, kind))
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
      if (captureRef.current) captureRef.current.value = ''
    }
  }

  function openCamera() {
    const coarse =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    const live =
      typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
    if (coarse || !live) {
      captureRef.current?.click()
      return
    }
    setCameraOpen(true)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg" id={labelId}>
        {label}
      </span>

      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        onChange={(e) => void upload(e.target.files?.[0])}
        disabled={disabled || busy}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => void upload(e.target.files?.[0])}
        disabled={disabled || busy}
        tabIndex={-1}
        aria-hidden="true"
      />

      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={cx(
              'overflow-hidden border border-line bg-surface2',
              shape === 'circle' ? 'h-20 w-20 rounded-full' : 'h-20 w-32 rounded-xl',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCamera}
              disabled={busy || disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-fg hover:bg-surface2 disabled:opacity-50"
            >
              <Camera size={14} /> Retake
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-fg hover:bg-surface2 disabled:opacity-50"
            >
              <Upload size={14} /> {busy ? 'Uploading…' : 'Choose file'}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={busy || disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg disabled:opacity-50"
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className={cx(
            'flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition-colors',
            dragging ? 'border-brand bg-brand-soft' : 'border-line bg-surface/60',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void upload(e.dataTransfer.files?.[0])
          }}
          aria-labelledby={labelId}
        >
          {busy ? (
            <>
              <Loader2 size={20} className="animate-spin text-brand" aria-hidden="true" />
              <span className="text-sm font-medium text-fg">Uploading…</span>
            </>
          ) : (
            <>
              <ImagePlus size={20} className="text-muted" aria-hidden="true" />
              <span className="text-sm font-semibold text-fg">Add a photo</span>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={openCamera}
                  disabled={disabled}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
                >
                  <Camera size={14} /> Take photo
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={disabled}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface2 disabled:opacity-50"
                >
                  <Upload size={14} /> Choose file
                </button>
              </div>
              <span className="text-xs text-muted">
                or drop an image here — PNG, JPEG, WebP up to {MAX_MB} MB
              </span>
            </>
          )}
        </div>
      )}

      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && (
        <span className="text-xs font-medium" role="alert" style={{ color: 'var(--neg)' }}>
          {error}
        </span>
      )}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => void upload(file)}
        onChooseFile={() => fileRef.current?.click()}
      />
    </div>
  )
}
