import { formatSigned } from '@/lib/format'

/**
 * The community score, shown honestly.
 *
 * The scale is −5…+10, not five stars, so the value is always signed and
 * negative scores read red. An unrated post says "Not rated" — never 0.0.
 */
export function RatingChip({
  avg,
  count,
  size = 'sm',
}: {
  avg: number | null
  count: number
  size?: 'sm' | 'md'
}) {
  const unrated = count === 0 || avg === null
  const value = avg ?? 0
  const tone = unrated ? 'zero' : value >= 1 ? 'pos' : value <= -1 ? 'neg' : 'zero'
  const color =
    tone === 'neg' ? 'var(--neg)' : tone === 'pos' ? 'var(--brand)' : 'var(--muted)'

  const base =
    size === 'md'
      ? 'gap-1.5 px-2.5 py-1 text-sm'
      : 'gap-1 px-1.5 py-0.5 text-xs'

  if (unrated) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-line bg-surface font-medium ${base}`}
        style={{ color: 'var(--muted)' }}
      >
        Not rated
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border font-semibold ${base}`}
      style={{
        color,
        borderColor: tone === 'neg' ? 'color-mix(in srgb, var(--neg) 40%, transparent)' : 'color-mix(in srgb, var(--brand) 40%, transparent)',
        background:
          tone === 'neg'
            ? 'color-mix(in srgb, var(--neg) 12%, transparent)'
            : 'color-mix(in srgb, var(--brand) 12%, transparent)',
      }}
      title={`Community average ${formatSigned(Number(value.toFixed(1)))} from ${count} ${
        count === 1 ? 'rating' : 'ratings'
      }`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
      {formatSigned(Number(value.toFixed(1)))}
    </span>
  )
}
