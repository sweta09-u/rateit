import { FeedSection } from '@/components/FeedSection'

export const metadata = { title: 'Leaderboard — Rate It' }

export default function LeaderboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-5 md:px-6 md:py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted">
          Straight from the community averages — no editorial picks.
        </p>
      </div>

      <FeedSection
        title="Highest rated"
        subtitle="Best average, across every post with at least one rating."
        sort="highest"
        limit={12}
        showRank
      />

      <FeedSection
        title="Lowest rated"
        subtitle="The ones the community did not take to."
        sort="lowest"
        limit={8}
        showRank
      />
    </div>
  )
}
