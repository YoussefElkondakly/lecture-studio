// Developer utility: reset to the seeded demo (manual job speed) and screenshot a list of routes.
// Usage: node scripts/tour.mjs <outDir> <width> <height> [--full] route1 route2 ...
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const [outDir, w, h, ...rest] = process.argv.slice(2)
const full = rest.includes('--full')
const routes = rest.filter((r) => r !== '--full')
const base = process.env.BASE_URL || 'http://localhost:5180'
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(base + '/')
await page.evaluate(() => window.__lectureStudio.reset({ speed: 'manual' }))
const results = []
for (const r of routes) {
  await page.goto(base + r)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(350)
  const name = r.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: full })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  results.push({ r, overflow })
}
console.log(JSON.stringify({ results, errors }, null, 1))
await browser.close()
