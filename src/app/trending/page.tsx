import { FeedSection } from '@/components/FeedSection'

export const metadata = { title: 'Trending — Rate It' }

export default function TrendingPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Trending on Rate It</h1>
        <p className="text-sm text-muted">
          Ranked by rating activity, weighted so recent posts rise faster.
        </p>
      </div>
      <FeedSection title="Right now" sort="trending" limit={24} columns="hero" />
    </div>
  )
}
