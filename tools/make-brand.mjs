#!/usr/bin/env node
/**
 * Builds the rabrate identity from code.
 *
 * The mark is a geometric monogram — a stroked "R" on an orange tile. Strokes
 * with round caps keep it legible from a 16px favicon to a 512px icon, and the
 * geometry is generated rather than hand-drawn, so every size stays crisp and
 * nothing depends on a font file being present.
 *
 * Wordmarks are rendered to PNG with Inter pulled from Google Fonts; the app
 * itself draws its wordmark as HTML text, so it never depends on these files.
 *
 * Usage: node tools/make-brand.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'brand')
const TMP = path.join(ROOT, '.brand-tmp')

/**
 * Any Chromium-based browser can render these — Chrome, Edge or Chromium.
 * Edge ships with Windows, so this works there with no extra install.
 */
function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = [
    '/usr/local/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ]
  const found = candidates.find((p) => { try { return fs.existsSync(p) } catch { return false } })
  if (!found) {
    console.error(
      '\nNo Chromium-based browser found.\n' +
        'Set CHROME_PATH to chrome.exe or msedge.exe, for example:\n' +
        '  PowerShell:  $env:CHROME_PATH="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"; node tools/make-brand.mjs\n',
    )
    process.exit(1)
  }
  return found
}

const CHROME = findBrowser()
console.log(`  using ${CHROME}`)

const ORANGE_LIGHT = '#FFA23A'
const ORANGE_DARK = '#FF7A00'
const INK = '#0F0F0F'
const PAPER = '#FFFFFF'

fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(TMP, { recursive: true })

/* ------------------------------------------------------------------ mark */

/** The R, as stroked geometry inside a 128×128 box. */
function rGlyph(stroke = 15) {
  return `
    <g fill="none" stroke="${PAPER}" stroke-width="${stroke}"
       stroke-linecap="round" stroke-linejoin="round">
      <path d="M42 34 V94" />
      <path d="M42 34 H58 A20 20 0 0 1 58 74 H42" />
      <path d="M62 74 L84 94" />
    </g>`
}

/** Full tile: rounded square + gradient + glyph. `radius` 0 = full bleed. */
function mark({ radius = 30, stroke = 15, id = 'g' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="rabrate">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ORANGE_LIGHT}" />
      <stop offset="1" stop-color="${ORANGE_DARK}" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="${radius}" fill="url(#${id})" />
  ${rGlyph(stroke)}
</svg>`
}

fs.writeFileSync(path.join(OUT, 'mark.svg'), mark())
// A slightly heavier stroke reads better at 16px
fs.writeFileSync(path.join(OUT, 'favicon.svg'), mark({ stroke: 17 }))
console.log('  mark.svg, favicon.svg')

/* ------------------------------------------------------- render helpers */

function shot(html, width, height, file, transparent = false) {
  const src = path.join(TMP, `${path.basename(file, '.png')}.html`)
  fs.writeFileSync(src, html)
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${width},${height}`,
      `--screenshot=${file}`,
      `--default-background-color=${transparent ? '00000000' : 'ffffffff'}`,
      '--virtual-time-budget=5000',
      `file://${src}`,
    ],
    { stdio: 'ignore' },
  )
}

const FONTS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;800&display=swap" rel="stylesheet">`

const base = (body, extra = '') => `<!doctype html><html><head><meta charset="utf-8">${FONTS}
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;overflow:hidden}
  body{display:flex;align-items:center;justify-content:center;
       font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
  ${extra}
</style></head><body>${body}</body></html>`

const svgTag = (size, radius = 30, stroke = 15) =>
  mark({ radius, stroke }).replace('width="128" height="128"', `width="${size}" height="${size}"`)

/* ------------------------------------------------------------- icons */

const iconJobs = [
  ['favicon-16.png', 16, 30, 17],
  ['favicon-32.png', 32, 30, 17],
  ['favicon-48.png', 48, 30, 16],
  ['icon-192.png', 192, 30, 15],
  ['icon-512.png', 512, 30, 15],
  ['mark.png', 512, 30, 15],
  // iOS applies its own mask, so ship a full-bleed square
  ['apple-touch-icon.png', 180, 0, 15],
]

for (const [name, size, radius, stroke] of iconJobs) {
  shot(
    base(svgTag(size, radius, stroke), 'body{background:transparent}'),
    size,
    size,
    path.join(OUT, name),
    true,
  )
  console.log(`  ${name} (${size}px)`)
}

/* --------------------------------------------------------- wordmarks */

const wordmark = (size, color) =>
  `<span style="font-weight:800;font-size:${size}px;letter-spacing:-0.04em;color:${color}">rabrate</span>`

// horizontal lockup — transparent, for light and dark surfaces
shot(
  base(
    `<div style="display:flex;align-items:center;gap:56px">
       ${svgTag(180)}
       ${wordmark(190, INK)}
     </div>`,
    'body{background:transparent}',
  ),
  1120,
  300,
  path.join(OUT, 'logo-horizontal.png'),
  true,
)
console.log('  logo-horizontal.png')

shot(
  base(
    `<div style="display:flex;flex-direction:column;align-items:center;gap:64px">
       ${svgTag(300)}
       ${wordmark(150, INK)}
     </div>`,
    'body{background:transparent}',
  ),
  1120,
  1200,
  path.join(OUT, 'logo-stacked.png'),
  true,
)
console.log('  logo-stacked.png')

// social card — dark, matches the app's dark theme
shot(
  base(
    `<div style="width:100%;height:100%;background:${INK};display:flex;flex-direction:column;
                 align-items:flex-start;justify-content:center;padding:96px;gap:40px">
       <div style="display:flex;align-items:center;gap:36px">
         ${svgTag(140)}
         ${wordmark(132, PAPER)}
       </div>
       <p style="font-weight:600;font-size:44px;line-height:1.25;color:#AAAAAA;max-width:900px">
         Post anything. Rate everything.<br>
         <span style="color:${ORANGE_LIGHT}">Every post scored −5 to +10 by the community.</span>
       </p>
     </div>`,
    'body{background:#0F0F0F;justify-content:flex-start}',
  ),
  1200,
  630,
  path.join(OUT, 'social-card.png'),
)
console.log('  social-card.png')

/* ------------------------------------------------------------- tidy */

// the old palette's SVGs are replaced by the generated ones; drop the rest
for (const stale of ['logo-horizontal.svg', 'logo-stacked.svg', 'social-card.svg', 'favicon-preview.png']) {
  const p = path.join(OUT, stale)
  if (fs.existsSync(p)) {
    fs.unlinkSync(p)
    console.log(`  removed ${stale}`)
  }
}

fs.rmSync(TMP, { recursive: true, force: true })
console.log(`\nbrand written to public/brand/`)
