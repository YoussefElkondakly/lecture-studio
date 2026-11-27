// Developer utility: screenshot a route of the running dev server for visual review.
// Usage: node scripts/shot.mjs <path> <out.png> [width=1440] [height=900] [--full] [--manual] [--reset] [--click=<text>]
import { chromium } from '@playwright/test'

const [path = '/', out = 'shot.png', w = '1440', h = '900', ...flags] = process.argv.slice(2)
const base = process.env.BASE_URL || 'http://localhost:5180'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(base + '/')
if (flags.includes('--reset')) {
  await page.evaluate((manual) => window.__lectureStudio.reset({ speed: manual ? 'manual' : 'fast' }), flags.includes('--manual'))
}
await page.goto(base + path)
await page.waitForLoadState('networkidle')
for (const f of flags.filter((x) => x.startsWith('--click='))) {
  await page.getByText(f.slice(8), { exact: false }).first().click()
  await page.waitForTimeout(300)
}
await page.waitForTimeout(400)
await page.screenshot({ path: out, fullPage: flags.includes('--full') })
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
console.log(JSON.stringify({ out, overflow, errors }))
await browser.close()
