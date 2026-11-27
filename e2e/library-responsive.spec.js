import { expect, test } from '@playwright/test'
import { approveHere, expectNoHorizontalOverflow, projectByTitle, resetDemo, settle } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
})

const VIEWPORTS = [
  [1440, 900], [1280, 800], [768, 1024], [390, 844], [320, 640],
]

for (const [w, h] of VIEWPORTS) {
  test(`no horizontal overflow on any screen at ${w}×${h}`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: w, height: h })
    const jaundice = await projectByTitle(page, 'Neonatal jaundice: a guide for parents')
    const asthma = await projectByTitle(page, 'Asthma action plans for school-age children')
    const growth = await projectByTitle(page, 'Growth charts for new residents')
    const done = await projectByTitle(page, 'Bronchiolitis: board-style review')
    const routes = ['/', '/lectures', '/lectures/new', '/reviews', '/prompts', '/skills', '/notifications', '/settings', '/settings?section=budget', '/settings?section=demo',
      `/lectures/${jaundice.id}/review/H1`, `/lectures/${asthma.id}/review/H4`, `/lectures/${growth.id}/review/H5`, `/lectures/${done.id}`, `/lectures/${done.id}?tab=deliverables`,
      `/lectures/${done.id}?tab=versions`, `/prompts/${jaundice.promptRefs.A.promptId}`]
    const bad = []
    for (const r of routes) {
      await page.goto(r)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (overflow > 0) bad.push(`${r}: ${overflow}px`)
    }
    expect(bad).toEqual([])
  })
}

test('prompt CRUD: create, duplicate, archive, restore and delete an unused prompt', async ({ page }) => {
  await page.goto('/prompts')
  await page.getByRole('button', { name: 'New prompt' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Create prompt' }).click()
  await expect(dialog.getByText('Enter a prompt title.')).toBeVisible()
  await dialog.getByLabel('Title').fill('Short storyboard variant')
  await dialog.getByLabel('Category').selectOption({ label: 'Storyboard (B)' })
  await dialog.getByLabel('Tags').fill('short, test')
  await dialog.getByLabel('Prompt text').fill('FICTIONAL EXAMPLE. Plan at most six scenes with very short on-screen text.')
  await dialog.getByRole('button', { name: 'Create prompt' }).click()
  await expect(page.getByRole('heading', { name: 'Short storyboard variant' })).toBeVisible()

  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByRole('heading', { name: 'Short storyboard variant (copy)' })).toBeVisible()
  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('It is hidden from prompt pickers.')).toBeVisible()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('It is hidden from prompt pickers.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete prompt' }).click()
  await expect(page).toHaveURL(/\/prompts$/)
  await expect(page.getByRole('link', { name: /Short storyboard variant \(copy\)/ })).toHaveCount(0)

  // Used prompts cannot be deleted
  await page.getByRole('link', { name: /Structured lecture extraction — doctors/ }).click()
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  await expect(page.getByText(/Used prompts can’t be deleted/)).toBeVisible()

  // Older versions are read-only
  await page.getByRole('button', { name: /v1/ }).first().click()
  await expect(page.getByText('Viewing version 1 (read-only)')).toBeVisible()
})

test('Claude Skills: add reference, verification refused until import, import + verify', async ({ page }) => {
  await page.goto('/skills')
  await page.getByRole('button', { name: 'Add Skill reference' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name (as shown in Claude)').fill('Case vignette illustrator')
  await dialog.getByRole('button', { name: 'Add reference' }).click()
  const card = page.getByRole('listitem').filter({ hasText: 'Case vignette illustrator' })
  await expect(card.getByText('Web reference only')).toBeVisible()
  await card.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByText(/cannot be verified for API use/).first()).toBeVisible()
  await card.getByRole('button', { name: 'Mock import' }).click()
  await expect(card.getByText('Unverified', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Verify' }).click()
  await expect(card.getByText('API ready (simulated)')).toBeVisible()
})

test('H3 storyboard direct edit creates a new version; H4 transcript edit is targeted', async ({ page }) => {
  test.setTimeout(90_000)
  const title = 'Iron-deficiency anaemia: a case-based review'
  await settle(page)
  let p = await projectByTitle(page, title)
  expect(p.stage).toBe('H4')
  // H4: edit chunk 02 only
  await page.goto(`/lectures/${p.id}/review/H4`)
  await page.getByRole('button', { name: 'Edit chunk 02' }).click()
  const box = page.getByLabel('Transcript 02')
  await box.fill((await box.inputValue()) + ' A clarifying sentence added by the doctor.')
  await page.getByRole('button', { name: 'Save new version' }).click()
  await expect(page.getByText('Your edit').first()).toBeVisible()
  p = await projectByTitle(page, title)
  expect(p.artifacts.transcripts['02']).toHaveLength(2)
  expect(p.artifacts.transcripts['01']).toHaveLength(1)
  for (const g of ['H1', 'H2', 'H3']) expect(p.approvals[g]).toBeTruthy()

  // H3 on another lecture: storyboard edit
  const j = await projectByTitle(page, 'Neonatal jaundice: a guide for parents')
  await page.goto(`/lectures/${j.id}/review/H1`)
  await approveHere(page)
  await approveHere(page)
  await settle(page)
  await page.goto(`/lectures/${j.id}/review/H3`)
  await page.getByRole('button', { name: 'Edit scenes' }).click()
  await page.getByLabel('Scene notes').first().fill('Use the clinic photo style here.')
  await page.getByRole('button', { name: 'Save new version' }).click()
  await expect(page.getByText(/Storyboard v2/).first()).toBeVisible()
  await expect(page.getByText('Your edit').first()).toBeVisible()
})

test.describe('phone layout', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('mobile navigation sheet and sticky decision bar', async ({ page }) => {
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await page.getByRole('dialog').getByRole('link', { name: /Pending reviews/ }).click()
    await expect(page.getByRole('heading', { name: 'Pending reviews' })).toBeVisible()
    await page.getByRole('link', { name: /Review H1/ }).click()
    await page.getByRole('button', { name: 'Approve', exact: true }).click()
    const panel = page.locator('#decision-mobile')
    await expect(panel.getByText(/Tick the medical review confirmation/).first()).toBeVisible()
    await panel.getByRole('checkbox', { name: /personally reviewed/ }).check()
    await page.getByRole('button', { name: 'Approve', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Confirm Claude Skills/ })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
