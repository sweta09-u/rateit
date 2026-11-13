#!/usr/bin/env node
/**
 * Copies the Vite app's Supabase settings into this app's .env.local.
 *
 * The old app reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY; Next only
 * exposes variables prefixed NEXT_PUBLIC_ to the browser. Rather than making
 * you retype the anon key, this reads the root .env.local and rewrites the
 * names. The key is never printed.
 */
import fs from 'node:fs'
import path from 'node:path'

const here = process.cwd()
const rootEnvPath = path.resolve(here, '..', '.env.local')
const target = path.resolve(here, '.env.local')

if (!fs.existsSync(rootEnvPath)) {
  console.error(
    `\nNo .env.local found at ${rootEnvPath}.\n\n` +
      'Create one in the project root first (copy .env.example), then run this again.\n',
  )
  process.exit(1)
}

const text = fs.readFileSync(rootEnvPath, 'utf8')

function read(key) {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, 'm'))
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null
}

const url = read('VITE_SUPABASE_URL')
const anon = read('VITE_SUPABASE_ANON_KEY')

if (!url || !anon) {
  console.error(
    '\nThe root .env.local is missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY.\n' +
      'Add both, then run this again.\n',
  )
  process.exit(1)
}

const body = [
  '# Generated from ../.env.local — safe to regenerate.',
  `NEXT_PUBLIC_SUPABASE_URL=${url}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
  '',
].join('\n')

fs.writeFileSync(target, body, 'utf8')
console.log(`Wrote web/.env.local (URL: ${url.replace(/\/\/.*/, '//…')}, anon key: ${anon.length} chars)`)
