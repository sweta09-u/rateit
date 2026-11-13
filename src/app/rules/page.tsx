import Link from 'next/link'

export const metadata = { title: 'Rules — rabrate' }

const RULES = [
  {
    title: 'Rate honestly',
    body: 'A rating is an opinion, not a weapon. Use the whole −5 to +10 range; if something is fine, say so with a mid score instead of reaching for an extreme.',
  },
  {
    title: 'Criticise the post, not the person',
    body: 'Explain what did not work. Abuse, threats and pile-ons aimed at an author are removed, and repeated behaviour gets an account suspended.',
  },
  {
    title: 'No spam or disguised promotion',
    body: 'Do not post the same thing repeatedly, and do not hide an advert behind a normal-looking post. Mark your own work if it is yours.',
  },
  {
    title: 'No private information',
    body: 'Sharing someone’s address, phone number, workplace or other identifying details is not allowed, even if it is public elsewhere.',
  },
  {
    title: 'One account per person',
    body: 'Vote manipulation — rating your own posts from extra accounts — is the fastest way to lose access.',
  },
  {
    title: 'You can delete your own content',
    body: 'Your posts, ratings and comments are yours. You can remove them at any time, or delete your account entirely from Settings.',
  },
]

export default function RulesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Community rules</h1>
      <p className="mt-1 text-sm text-muted">
        rabrate works because people rate honestly. These are the few things that keep it that way.
      </p>

      <ol className="mt-6 flex flex-col gap-4">
        {RULES.map((rule, index) => (
          <li key={rule.title} className="rounded-xl border border-line bg-surface p-4">
            <h2 className="flex items-baseline gap-2 text-base font-semibold">
              <span className="text-sm font-bold tabular-nums text-brand">{index + 1}.</span>
              {rule.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-fg/85">{rule.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-sm text-muted">
        See something that breaks these? Use the report control on the post. Moderators review
        every report.
      </p>

      <Link
        href="/"
        className="mt-6 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover"
      >
        Back to the feed
      </Link>
    </div>
  )
}
