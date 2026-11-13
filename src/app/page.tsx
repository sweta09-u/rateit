import { Suspense } from 'react'
import { CategoryChips } from '@/components/CategoryChips'
import { FeedSection } from '@/components/FeedSection'

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-5 md:px-6 md:py-6">
      <Suspense fallback={<div className="h-9" />}>
        <CategoryChips />
      </Suspense>

      <FeedSection
        title="Trending on rabrate"
        subtitle="Busiest posts right now, weighted by recency."
        sort="trending"
        limit={6}
        columns="hero"
        seeAllHref="/trending"
      />

      <FeedSection
        title="Top rated"
        subtitle="The highest community averages on the site."
        sort="highest"
        limit={4}
        seeAllHref="/leaderboard"
      />

      <FeedSection
        title="Recently added"
        subtitle="Fresh posts that have not been rated yet."
        sort="latest"
        limit={8}
        seeAllHref="/explore"
      />

      <FeedSection
        title="Most debated"
        subtitle="Where the community is most split."
        sort="controversial"
        limit={4}
        seeAllHref="/explore"
      />
    </div>
  )
}
