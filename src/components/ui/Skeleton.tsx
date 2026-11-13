import { cx } from '@/lib/format'

/** A shimmering placeholder block used while real data loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('relative overflow-hidden rounded-xl bg-surface2', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-2/5" />
    </div>
  )
}
