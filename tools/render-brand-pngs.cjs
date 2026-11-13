/**
 * Render the RateIt brand SVGs to PNG.
 *
 *   CHROME_PATH=/path/to/chromium node tools/render-brand-pngs.cjs
 *
 * Writes the icon set (favicon sizes, apple-touch-icon, PWA icons), the
 * social card, and large previews of the lockups into public/brand/.
 */
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const ROOT = path.resolve(__dirname, '..')
const BRAND = process.env.BRAND_DIR || path.join(ROOT, 'public', 'brand')
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/chromium'

/** [source svg, output png, width, height, transparent?] */
const TARGETS = [
  ['favicon.svg', 'favicon-16.png', 16, 16, true],
  ['favicon.svg', 'favicon-32.png', 32, 32, true],
  ['favicon.svg', 'favicon-48.png', 48, 48, true],
  ['mark.svg', 'apple-touch-icon.png', 180, 180, false],
  ['mark.svg', 'icon-192.png', 192, 192, false],
  ['mark.svg', 'icon-512.png', 512, 512, false],
  ['mark.svg', 'mark.png', 512, 512, false],
  ['favicon.svg', 'favicon-preview.png', 256, 256, false],
  ['logo-horizontal.svg', 'logo-horizontal.png', 1120, 300, false],
  ['logo-stacked.svg', 'logo-stacked.png', 1120, 1200, false],
  ['social-card.svg', 'social-card.png', 1200, 630, false],
]

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
  })

  for (const [src, out, w, h, transparent] of TARGETS) {
    const svg = fs.readFileSync(path.join(BRAND, src), 'utf8')
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>
         html,body{margin:0;padding:0;background:${transparent ? 'transparent' : '#ffffff'};}
         svg{display:block;width:${w}px;height:${h}px;}
       </style></head><body>${svg}</body></html>`,
      { waitUntil: 'load' },
    )
    await page.screenshot({
      path: path.join(BRAND, out),
      omitBackground: transparent,
      type: 'png',
    })
    await page.close()
    console.log(`  ${out.padEnd(26)} ${w}x${h}${transparent ? ' (transparent)' : ''}`)
  }

  await browser.close()
  console.log('brand PNGs written to public/brand/')
}

main().catch((err) => {
  console.error('render failed:', err)
  process.exit(1)
})
