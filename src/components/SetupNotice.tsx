'use client'

import { missingConfig } from '@/lib/supabase'

/**
 * Shown instead of the app when the Supabase environment variables are absent.
 * It names exactly what is missing, because "connect Supabase" alone does not
 * tell you whether the variables are missing, misnamed, or set after the build.
 */
export function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.svg" alt="" width={34} height={34} className="rounded-lg" />
        <span className="text-lg font-bold tracking-tight">
          Rate<span className="text-brand">It</span>
        </span>
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight">Connect Supabase to finish setup</h1>

      <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'color-mix(in srgb, var(--neg) 40%, transparent)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--neg)' }}>
          Missing at build time:
        </p>
        <ul className="mt-1.5 space-y-1">
          {missingConfig.map((name) => (
            <li key={name} className="font-mono text-sm text-fg">
              {name}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted">
        Next.js inlines these into the browser bundle at <span className="text-fg">build</span> time.
        Setting them after a build has no effect — the site must be rebuilt. The names must match
        exactly; <span className="font-mono text-xs text-fg">VITE_…</span> will not work.
      </p>

      <p className="mt-5 text-sm font-semibold text-fg">On Netlify</p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Site configuration → Environment variables → Add a variable</li>
        <li>Add both, scoped to Production <em>and</em> Deploys</li>
        <li>
          Deploys → Trigger deploy → <span className="text-fg">Clear cache and deploy site</span>
        </li>
      </ol>

      <p className="mt-5 text-sm font-semibold text-fg">Locally</p>
      <p className="mt-1.5 text-sm text-muted">
        Copy <span className="font-mono text-xs text-fg">.env.example</span> to{' '}
        <span className="font-mono text-xs text-fg">.env.local</span>, fill in both values, and
        restart the dev server.
      </p>

      <p className="mt-5 text-sm text-muted">
        Both values are in Supabase under{' '}
        <span className="text-fg">Project Settings → API</span>. The anon key is safe to ship; the{' '}
        <span className="text-fg">service_role</span> key must never be used here.
      </p>
    </div>
  )
}
