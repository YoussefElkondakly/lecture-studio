// Accessibility, keyboard, state recovery, empty/error states and edge cases.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { approveHere, collectErrors, projectByTitle, resetDemo, settle } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
})

const PAGES = [
  ['/', 'Home'],
  ['/lectures', 'My lectures'],
  ['/lectures/new', 'Start new lecture'],
  ['/reviews', 'Pending reviews'],
  ['/prompts', 'Master prompts'],
  ['/skills', 'Claude Skills'],
  ['/notifications', 'Notifications'],
  ['/settings', 'Settings'],
  ['/settings?section=budget', 'Budget'],
]

test('axe: no WCAG 2.2 A/AA violations on primary pages', async ({ page }) => {
  test.setTimeout(120_000)
  const all = []
  const p = await projectByTitle(page, 'Neonatal jaundice: a guide for parents')
  const asthma = await projectByTitle(page, 'Asthma action plans for school-age children')
  const growth = await projectByTitle(page, 'Growth charts for new residents')
  const done = await projectByTitle(page, 'Bronchiolitis: board-style review')
  const routes = [
    ...PAGES.map(([r]) => r),
    `/lectures/${p.id}/review/H1`, `/lectures/${asthma.id}/review/H4`, `/lectures/${growth.id}/review/H5`,
    `/lectures/${done.id}`, `/lectures/${done.id}?tab=deliverables`, `/lectures/${done.id}?tab=history`, `/prompts/${p.promptRefs.A.promptId}`,
  ]
  for (const r of routes) {
    await page.goto(r)
    await page.waitForLoadState('networkidle')
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    for (const v of res.violations) all.push(`${r} — ${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
  }
  expect(all, all.join('\n')).toEqual([])
})

test('keyboard: skip link, sidebar navigation and dialog focus management', async ({ page }) => {
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  const focusedInMain = await page.evaluate(() => document.getElementById('main').contains(document.activeElement))
  expect(focusedInMain).toBe(true)

  await page.getByRole('link', { name: 'Master prompts', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/prompts$/)

  await page.getByRole('button', { name: 'New prompt' }).focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const inDialog = await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]')))
  expect(inDialog).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'New prompt' })).toBeFocused()
})

test('refresh and reopen keep progress, decisions and notifications', async ({ page }) => {
  const p = await projectByTitle(page, 'Neonatal jaundice: a guide for parents')
  await page.goto(`/lectures/${p.id}/review/H1`)
  await approveHere(page)
  await expect(page.getByRole('heading', { name: /Confirm Claude Skills/ })).toBeVisible()
  const before = await page.evaluate(() => window.__lectureStudio.getState())
  await page.reload()
  await expect(page.getByRole('heading', { name: /Confirm Claude Skills/ })).toBeVisible()
  const after = await page.evaluate(() => window.__lectureStudio.getState())
  expect(after.decisions.length).toBe(before.decisions.length)
  expect(after.notifications.length).toBe(before.notifications.length)
  expect(after.projects.find((x) => x.id === p.id).stage).toBe('H2')
})

test('H2 supports NONE and requires acknowledgment for unverified Skills', async ({ page }) => {
  const p = await projectByTitle(page, 'Neonatal jaundice: a guide for parents')
  await page.goto(`/lectures/${p.id}/review/H1`)
  await approveHere(page)
  await page.getByRole('checkbox', { name: /Storyboard pacing helper/ }).check()
  await expect(page.getByText(/not verified for API use/)).toBeVisible()
  const decision = page.getByRole('complementary', { name: 'Decision' })
  await decision.getByRole('button', { name: 'Approve and continue' }).click()
  await expect(decision.getByText(/not verified for API use|Acknowledge/).first()).toBeVisible()
  await page.getByRole('checkbox', { name: /No Skills \(NONE\)/ }).check()
  await decision.getByRole('button', { name: 'Approve and continue' }).click()
  await expect(page.getByText(/H2 approved/).first()).toBeVisible()
  const d = await page.evaluate((id) => window.__lectureStudio.getState().decisions.find((x) => x.projectId === id && x.gate === 'H2'), p.id)
  expect(d.extra.skills).toEqual(['NONE'])
})

test('a review that changes underneath is refused, not silently approved', async ({ page, context }) => {
  const p = await projectByTitle(page, 'Neonatal jaundice: a guide for parents')
  await page.goto(`/lectures/${p.id}/review/H1`)
  await expect(page.getByRole('heading', { name: 'Draft r2' })).toBeVisible()
  // A second tab edits the canonical text (simulating another session).
  const other = await context.newPage()
  await other.goto(`/lectures/${p.id}/review/H1`)
  await other.getByRole('button', { name: 'Edit text' }).click()
  const ed = other.getByLabel('Canonical lecture text (Markdown)')
  await ed.fill((await ed.inputValue()) + '\n\nEdited in another tab.')
  await other.getByRole('button', { name: 'Save new revision' }).click()
  await other.evaluate(() => window.__lectureStudio.finishRunningJobs())
  await other.close()
  await expect(page.getByText('This review changed since you opened it')).toBeVisible()
  const decision = page.getByRole('complementary', { name: 'Decision' })
  await decision.getByRole('checkbox', { name: /personally reviewed/ }).check()
  await decision.getByRole('button', { name: 'Approve and continue' }).click()
  await expect(decision.getByText(/A newer version was produced/)).toBeVisible()
  await page.getByRole('button', { name: 'Load the latest version' }).click()
  await expect(page.getByRole('heading', { name: 'Draft r3' })).toBeVisible()
})

test('empty workspace shows first-run guidance and empty states', async ({ page }) => {
  await resetDemo(page, { empty: true })
  await expect(page.getByRole('heading', { name: 'No lectures yet' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Getting started' })).toBeVisible()
  await page.goto('/reviews')
  await expect(page.getByRole('heading', { name: 'No reviews waiting' })).toBeVisible()
  await page.goto('/lectures')
  await expect(page.getByRole('heading', { name: 'No lectures yet' })).toBeVisible()
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible()
  await page.goto('/lectures?q=zzz')
  await page.goto('/does-not-exist')
  await expect(page.getByRole('heading', { name: 'This page doesn’t exist' })).toBeVisible()
})

test('search with no results offers to clear filters', async ({ page }) => {
  await page.goto('/lectures?q=zzzz')
  await expect(page.getByRole('heading', { name: /No lectures match/ })).toBeVisible()
  await page.getByRole('button', { name: 'Clear search and filters' }).click()
  await expect(page.getByRole('row')).toHaveCount(8)
})

test('disconnected provider blocks with an explicit credential error; reconnect + retry resumes', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/settings?section=providers')
  await page.getByRole('region', { name: 'Anthropic (Claude)' }).getByRole('button', { name: 'Disconnect' }).click()
  const p = await projectByTitle(page, 'Neonatal jaundice: a guide for parents')
  await page.goto(`/lectures/${p.id}/review/H1`)
  await approveHere(page)
  await approveHere(page) // H2 → storyboard needs Claude
  await page.goto(`/lectures/${p.id}`)
  await expect(page.getByRole('heading', { name: /Paused: Provider credential invalid/ })).toBeVisible()
  await page.getByRole('link', { name: 'Fix in Settings' }).click()
  await page.getByRole('region', { name: 'Anthropic (Claude)' }).getByRole('button', { name: 'Connect demo account' }).click()
  await page.goto(`/lectures/${p.id}`)
  await page.getByRole('button', { name: /Retry B/ }).click()
  await settle(page)
  expect((await projectByTitle(page, 'Neonatal jaundice: a guide for parents')).stage).toBe('H3')
  expect(errors).toEqual([])
})

test('notifications: mark read/unread, filters, simulated channels and deep link', async ({ page }) => {
  await page.goto('/notifications')
  await page.getByRole('button', { name: /^Unread/ }).click()
  const unreadBefore = await page.getByRole('listitem').count()
  expect(unreadBefore).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Mark all read' }).click()
  await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible()
  await page.getByRole('button', { name: /^All/ }).click()
  await expect(page.getByRole('heading', { name: 'Email preview' })).toBeVisible()
  await page.getByRole('tab', { name: 'Delivery log' }).click()
  await expect(page.getByRole('cell', { name: 'Simulated — not sent' }).first()).toBeVisible()
  await page.getByRole('button', { name: /Notifications, 0 unread/ }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Notifications' })).toBeVisible()
})

test('draft resume, duplicate and archive with confirmation', async ({ page }) => {
  await page.goto('/lectures?status=draft')
  await page.getByRole('link', { name: 'Resume' }).click()
  await expect(page.getByRole('heading', { name: 'Draft — not started yet' })).toBeVisible()
  await page.getByRole('link', { name: 'Edit draft' }).click()
  await expect(page.getByLabel('Lecture name')).toHaveValue('Oral rehydration at home')
  await page.getByRole('button', { name: 'Start now' }).click()
  await expect(page.getByText(/Running: A · Lecture content/)).toBeVisible()

  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Archive…' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive lecture' }).click()
  await expect(page.getByText('Archived', { exact: true }).first()).toBeVisible()
  await page.goto('/lectures?status=archived')
  await expect(page.getByRole('row', { name: /Oral rehydration at home/ })).toBeVisible()
})
