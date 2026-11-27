// Verifies a GitHub Pages deployment (live or emulated) end to end.
// Run: PAGES_URL=https://youssefelkondakly.github.io/lecture-studio/ pnpm test:pages
// Paths are relative (no leading slash) so they resolve under the /lecture-studio/ base.
import { expect, test } from '@playwright/test'

const SHOTS = process.env.PAGES_SHOTS_DIR // e.g. docs/screenshots/live — optional

test.skip(!process.env.PAGES_URL, 'Set PAGES_URL to the deployed site')

/** Console errors, ignoring the expected 404 status GitHub Pages returns for deep-link fallbacks. */
function watch(page) {
  const errors = []
  const offsite = []
  const host = new URL(process.env.PAGES_URL).host
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (!['data:', 'blob:'].includes(u.protocol) && u.host !== host) offsite.push(r.url())
  })
  return { errors, offsite }
}

async function fresh(page) {
  await page.goto('./')
  await page.waitForFunction(() => Boolean(window.__lectureStudio))
  await page.evaluate(() => window.__lectureStudio.reset({ speed: 'manual' }))
  await page.goto('./')
  await expect(page.getByRole('heading', { name: /Dr\. Ashraf/ })).toBeVisible()
}

async function finishJobs(page) {
  for (let i = 0; i < 8; i++) {
    const running = await page.evaluate(() => window.__lectureStudio.getState().jobs.filter((j) => j.status === 'running').length)
    if (!running) return
    await page.evaluate(() => window.__lectureStudio.finishRunningJobs())
  }
}

async function shot(page, name, full = false) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full })
}

const project = (page, title) => page.evaluate((t) => window.__lectureStudio.getState().projects.find((p) => p.title === t), title)

test('loads under the project path with assets, fonts, notice and no off-site requests', async ({ page, request }) => {
  const w = watch(page)
  await fresh(page)
  await expect(page.getByRole('note', { name: 'Demonstration prototype notice' })).toContainText('Do not enter real medical records')
  expect(new URL(page.url()).pathname).toMatch(/^\/lecture-studio\/$/)
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return ['Source Sans 3 Variable', 'Source Serif 4 Variable'].map((f) => document.fonts.check(`16px "${f}"`)) })
  expect(fonts).toEqual([true, true])
  for (const asset of ['favicon.svg', 'samples/final-video-sample.mp4', 'samples/final-video-sample.vtt', 'samples/voice-en-01.m4a', 'samples/voice-ar-01.m4a', 'samples/final-video-poster.jpg']) {
    const r = await request.get(asset)
    expect(r.status(), asset).toBe(200)
  }
  await shot(page, '01-home-1440')
  expect(w.errors).toEqual([])
  expect(w.offsite).toEqual([])
})

test('every navigation destination, direct links and refresh of nested routes', async ({ page }) => {
  const w = watch(page)
  await fresh(page)
  for (const [link, heading] of [
    ['My lectures', 'My lectures'], ['Pending reviews', 'Pending reviews'], ['Master prompts', 'Master prompts'],
    ['Claude Skills', 'Claude Skills'], ['Settings', 'Settings'], ['Home', /Dr\. Ashraf/],
  ]) {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: new RegExp(`^${link}`) }).click()
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }
  const j = await project(page, 'Neonatal jaundice: a guide for parents')
  // Direct deep link on a cold load (served by 404.html fallback) and refresh
  const resp = await page.goto(`lectures/${j.id}/review/H1`)
  expect([200, 404]).toContain(resp.status())
  await expect(page.getByRole('heading', { name: 'Medical content review' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Medical content review' })).toBeVisible()
  await page.goto('settings?section=budget')
  await expect(page.getByRole('heading', { name: 'This month' })).toBeVisible()
  await page.goto('this/route/does/not/exist')
  await expect(page.getByRole('heading', { name: 'This page doesn’t exist' })).toBeVisible()
  expect(w.errors).toEqual([])
})

test('start a lecture, simulated processing, notification deep link, approve and reject', async ({ page }) => {
  const w = watch(page)
  await fresh(page)
  await page.goto('lectures/new')
  await page.getByLabel('Lecture name').fill('Hosted demo lecture')
  await page.getByLabel('Demo source file').selectOption('src-hydration')
  await page.getByRole('button', { name: 'Start now' }).click()
  await expect(page.getByText(/Running: A · Lecture content/)).toBeVisible()
  await shot(page, '03-processing-1440')
  await finishJobs(page)
  // Notification → deep link
  await page.getByRole('button', { name: /Notifications, \d+ unread/ }).click()
  await page.getByRole('dialog').getByRole('link', { name: /H1 · Medical content ready for review/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Medical content review' })).toBeVisible()
  expect(page.url()).toContain('/lecture-studio/lectures/')
  // Approve H1 → H2 opens directly
  const decision = page.getByRole('complementary', { name: 'Decision' })
  await decision.getByRole('checkbox', { name: /personally reviewed/ }).check()
  await decision.getByRole('button', { name: 'Approve and continue' }).click()
  await expect(page.getByRole('heading', { name: 'Confirm Claude Skills' })).toBeVisible()
  await shot(page, '04-h2-skills-1440')
  // Reject at H1 on the seeded Arabic lecture
  const j = await project(page, 'Neonatal jaundice: a guide for parents')
  await page.goto(`lectures/${j.id}/review/H1`)
  await shot(page, '05-h1-review-1440')
  await page.getByRole('complementary', { name: 'Decision' }).getByRole('button', { name: 'Request changes' }).click()
  await page.getByRole('dialog').getByLabel('What should change?').fill('Keep the warning signs exactly as written in the source.')
  await page.getByRole('dialog').getByRole('button', { name: 'Send request' }).click()
  await expect.poll(async () => (await project(page, 'Neonatal jaundice: a guide for parents')).stage).toBe('A')
  expect(w.errors).toEqual([])
})

test('pending reviews, prompt categories, Skills, notifications and settings', async ({ page }) => {
  const w = watch(page)
  await fresh(page)
  await page.goto('reviews')
  await expect(page.getByRole('link', { name: /Review H4 for Asthma/ })).toBeVisible()
  await shot(page, '02-pending-reviews-1440')
  await page.goto('prompts')
  await page.getByRole('button', { name: 'Manage categories' }).click()
  await page.getByRole('button', { name: 'Create category' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Hosted test category')
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Storyboard (B)' }).check()
  await page.getByRole('dialog').getByRole('button', { name: 'Create category' }).click()
  await expect(page.getByRole('dialog').getByText('Hosted test category')).toBeVisible()
  await shot(page, '06-prompt-categories-1440')
  await page.keyboard.press('Escape')
  await page.goto('skills')
  const card = page.getByRole('listitem').filter({ hasText: 'Storyboard pacing helper' })
  await card.getByRole('button', { name: 'Verify' }).click()
  await expect(card.getByText('API ready (simulated)')).toBeVisible()
  await shot(page, '07-skills-1440')
  await page.goto('notifications')
  await page.getByRole('tab', { name: 'Delivery log' }).click()
  await expect(page.getByRole('cell', { name: 'Simulated — not sent' }).first()).toBeVisible()
  await shot(page, '08-notifications-1440')
  await page.goto('settings?section=providers')
  await expect(page.getByText('Never enter real API keys here')).toBeVisible()
  await shot(page, '09-settings-1440')
  expect(w.errors).toEqual([])
})

test('deliverable downloads and media, persistence across reload', async ({ page }) => {
  const w = watch(page)
  await fresh(page)
  const done = await project(page, 'Bronchiolitis: board-style review')
  await page.goto(`lectures/${done.id}?tab=deliverables`)
  await expect(page.locator('video')).toBeVisible()
  const md = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download lecture_master.md' }).click()
  expect((await md).suggestedFilename()).toMatch(/lecture_master_r1\.md$/)
  const pdf = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download doctor_review.pdf' }).click()
  const pdfPath = await (await pdf).path()
  const { readFileSync } = await import('node:fs')
  expect(readFileSync(pdfPath).subarray(0, 5).toString()).toBe('%PDF-')
  const playable = await page.locator('video').evaluate((v) => new Promise((res) => {
    if (v.readyState >= 1) return res(v.duration)
    v.addEventListener('loadedmetadata', () => res(v.duration), { once: true })
    v.load()
  }))
  expect(playable).toBeGreaterThan(5)
  await shot(page, '10-deliverables-1440')
  // Persistence: a decision survives reload
  const g = await project(page, 'Growth charts for new residents')
  await page.goto(`lectures/${g.id}/review/H5`)
  const decision = page.getByRole('complementary', { name: 'Decision' })
  await decision.getByRole('checkbox', { name: /accept the timing exception/ }).check()
  await decision.getByRole('button', { name: 'Approve and continue' }).click()
  await page.reload()
  expect((await project(page, 'Growth charts for new residents')).approvals.H5).toBeTruthy()
  expect(w.errors).toEqual([])
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('home and a review fit a 390 px phone', async ({ page }) => {
    const w = watch(page)
    await fresh(page)
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await shot(page, '11-home-390', true)
    const a = await project(page, 'Asthma action plans for school-age children')
    await page.goto(`lectures/${a.id}/review/H4`)
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible()
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await shot(page, '12-h4-review-390')
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await shot(page, '13-navigation-390')
    expect(w.errors).toEqual([])
  })
})
