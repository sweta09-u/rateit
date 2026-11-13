'use client'

import { useEffect, useRef, useState } from 'react'
import { Modal } from './ui/Modal'

const MAX_EDGE = 2000
/** A just-released device refuses the next request briefly; retry quietly. */
const RETRY_DELAYS = [0, 300, 800]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function cameraMessage(err: unknown): string {
  const name = (err as DOMException | undefined)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access is blocked for this site. Allow it in your browser’s site settings, then try again — or choose a file instead.'
  }
  if (name === 'NotFoundError') return 'No camera was found on this device. Choose a file instead.'
  if (name === 'OverconstrainedError')
    return 'This camera cannot provide a usable video stream. Choose a file instead.'
  if (name === 'NotReadableError' || name === 'AbortError')
    return 'The camera is busy or did not start. Another app or tab may be holding it — close that, then try again. You can also choose a file instead.'
  if (name === 'NotSupportedError')
    return 'This browser cannot open a camera. Choose a file instead.'
  return 'The camera could not be opened. Try again, or choose a file instead.'
}

/** Live camera preview with a shutter, for devices without a native capture input. */
export function CameraCapture({
  open,
  onClose,
  onCapture,
  onChooseFile,
}: {
  open: boolean
  onClose: () => void
  onCapture: (file: File) => void
  onChooseFile?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const attemptRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!open) return
    const attempt = (attemptRef.current += 1)
    let cancelled = false
    setReady(false)
    setError(null)

    const release = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }

    async function acquire(): Promise<MediaStream> {
      const media = navigator.mediaDevices
      if (!media?.getUserMedia) {
        throw new DOMException(
          window.isSecureContext ? 'unsupported' : 'insecure',
          'NotSupportedError',
        )
      }
      const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
      const constraints: MediaStreamConstraints = {
        video: coarse
          ? { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }
          : { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      }
      let lastError: unknown
      for (const delay of RETRY_DELAYS) {
        if (delay) await sleep(delay)
        if (cancelled || attempt !== attemptRef.current) {
          throw new DOMException('superseded', 'AbortError')
        }
        try {
          return await media.getUserMedia(constraints)
        } catch (err) {
          lastError = err
          const name = (err as DOMException)?.name
          if (name !== 'NotReadableError' && name !== 'AbortError') break
        }
      }
      if ((lastError as DOMException)?.name === 'OverconstrainedError') {
        return media.getUserMedia({ video: true, audio: false })
      }
      throw lastError
    }

    async function start() {
      try {
        const stream = await acquire()
        if (cancelled || attempt !== attemptRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          try {
            await video.play()
          } catch {
            /* autoplay can be refused; onCanPlay still fires */
          }
        }
        if (!cancelled) setReady(true)
      } catch (err) {
        if (cancelled || attempt !== attemptRef.current) return
        const name = (err as DOMException)?.name
        if (name === 'NotSupportedError' && !window.isSecureContext) {
          setError('The camera needs a secure (https) connection, or choose a file instead.')
          return
        }
        setError(cameraMessage(err))
      }
    }

    void start()
    return () => {
      cancelled = true
      release()
    }
  }, [open, retry])

  async function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setBusy(true)
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight))
      const width = Math.round(video.videoWidth * scale)
      const height = Math.round(video.videoHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('The photo could not be processed.')
      ctx.drawImage(video, 0, 0, width, height)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
      if (!blob) throw new Error('The photo could not be processed.')
      onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The photo could not be captured.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Take a photo"
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg"
          >
            {error ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => void capture()}
            disabled={!ready || busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? 'Capturing…' : 'Capture'}
          </button>
        </>
      }
    >
      {error ? (
        <div className="text-center" role="alert">
          <p className="text-sm" style={{ color: 'var(--neg)' }}>
            {error}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-fg hover:bg-surface2"
            >
              Try again
            </button>
            {onChooseFile && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onChooseFile()
                }}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
              >
                Choose a file instead
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            onCanPlay={() => setReady(true)}
            aria-label="Camera preview"
            className="max-h-[62vh] w-full rounded-xl bg-black object-cover"
          />
          {!ready && (
            <p className="absolute inset-x-0 bottom-3 text-center text-sm text-white">
              Starting the camera…
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
