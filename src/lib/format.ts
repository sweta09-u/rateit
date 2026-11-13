/** Small formatting and class-name helpers. */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** "just now", "12m ago", "3h ago", "2d ago", then a date. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.floor((Date.now() - then) / 1000)

  if (seconds < 45) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * The community average, always to one decimal place.
 * Returns an em dash when there are no ratings at all.
 */
export function formatAverage(avg: number | null, count: number): string {
  if (count === 0 || avg === null || avg === undefined) return '—'
  return Number(avg).toFixed(1)
}

/** An individual rating, signed so it is never mistaken for an average. */
export function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`
}

export type Tone = 'pos' | 'neg' | 'zero'

/** Green for positive, red for negative, neutral at exactly zero. */
export function ratingTone(value: number): Tone {
  if (value >= 1) return 'pos'
  if (value <= -1) return 'neg'
  return 'zero'
}

export function excerpt(text: string, max = 240): string {
  const clean = text.trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trimEnd()}…`
}

export function initials(name: string): string {
  // Drop punctuation first, so "Alex (demo)" yields "AD" rather than "A(".
  const cleaned = name
    .replace(/^@/, '')
    .replace(/[^\p{L}\p{N}\s_.-]/gu, '')
    .trim()
  const parts = cleaned.split(/[\s_.-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Human-readable label for a report reason value. */
export function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    spam: 'Spam',
    harassment: 'Harassment',
    threats: 'Threats',
    doxxing: 'Doxxing',
    illegal: 'Illegal content',
    hate: 'Hate speech',
    other: 'Other',
  }
  return map[reason] ?? reason
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`
}
