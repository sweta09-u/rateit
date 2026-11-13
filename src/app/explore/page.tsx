'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CategoryChips } from '@/components/CategoryChips'
import { FeedSection } from '@/components/FeedSection'
import { CATEGORIES, SORTS } from '@/lib/constants'
import type { Category, SortMode } from '@/lib/types'

function ExploreInner() {
  const params = useSearchParams()
  const rawCategory = params.get('category')
  const search = params.get('q')?.trim() || null
  const category = (CATEGORIES as string[]).includes(rawCategory ?? '')
    ? (rawCategory as Category)
    : null

  const [sort, setSort] = useState<SortMode>('latest')

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {search ? `Results for “${search}”` : category ? category : 'Explore'}
        </h1>
        <p className="text-sm text-muted">
          {search
            ? 'Matching posts from the whole feed.'
            : 'Browse by category, or sort the whole feed another way.'}
        </p>
      </div>

      <div id="categories" className="scroll-mt-20">
        <CategoryChips active={category} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="sort" className="text-sm font-medium text-muted">
          Sort
        </label>
        <select
          id="sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortMode)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <FeedSection
        key={`${sort}-${category ?? 'all'}-${search ?? ''}`}
        title="Posts"
        sort={sort}
        category={category}
        search={search}
        limit={24}
      />
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6">
          <div className="h-64 animate-pulse rounded-xl bg-surface" />
        </div>
      }
    >
      <ExploreInner />
    </Suspense>
  )
}
