import { expect } from '@playwright/test'

/** Fresh synthetic demo with manual job speed (deterministic — jobs only finish when told). */
export async function resetDemo(page, { empty = false } = {}) {
  await page.goto('/')
  await page.waitForFunction(() => Boolean(window.__lectureStudio))
  await page.evaluate((e) => window.__lectureStudio.reset({ speed: 'manual', empty: e }), empty)
  await page.goto('/')
}

/** Finish running simulated jobs until the pipeline reaches a human gate (or nothing is running). */
export async function settle(page) {
  for (let i = 0; i < 8; i++) {
    const running = await page.evaluate(() => window.__lectureStudio.getState().jobs.filter((j) => j.status === 'running').length)
    if (!running) return
    await page.evaluate(() => window.__lectureStudio.finishRunningJobs())
  }
}

export async function projectByTitle(page, title) {
  return page.evaluate((t) => window.__lectureStudio.getState().projects.find((p) => p.title === t), title)
}

export async function stageOf(page, title) {
  return (await projectByTitle(page, title))?.stage
}

export function collectErrors(page) {
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  return errors
}

export async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

/** Approve the current review page, ticking whatever confirmations are visible. */
export async function approveHere(page) {
  const decision = page.getByRole('complementary', { name: 'Decision' })
  await decision.getByRole('button', { name: 'Approve and continue' }).waitFor()
  for (const name of [/personally reviewed/i, /accept the timing exception/i, /watched the complete final video/i]) {
    const box = decision.getByRole('checkbox', { name })
    if (await box.count()) await box.check()
  }
  await decision.getByRole('button', { name: 'Approve and continue' }).click()
}

export async function startLecture(page, { title, sourceId = 'src-asthma', minutes } = {}) {
  await page.goto('/lectures/new')
  await page.getByLabel('Lecture name').fill(title)
  await page.getByLabel('Demo source file').selectOption(sourceId)
  if (minutes) {
    await page.getByRole('button', { name: 'Change preferences' }).click()
    await page.getByLabel('Target video duration (minutes)').fill(String(minutes))
  }
  await page.getByRole('button', { name: 'Start now' }).click()
  await expect(page.getByText('Lecture started', { exact: true }).first()).toBeVisible()
}
