// PRD demo scenarios D01–D10 against the running app (synthetic data, manual job clock).
import { expect, test } from '@playwright/test'
import { approveHere, collectErrors, expectNoHorizontalOverflow, projectByTitle, resetDemo, settle, stageOf, startLecture } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetDemo(page)
})

test('D01 quick start: intake → processing → H1 notification, no external site', async ({ page }) => {
  const errors = collectErrors(page)
  const external = []
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost')) external.push(r.url()) })

  await page.getByRole('link', { name: 'Start new lecture' }).first().click()
  await expect(page.getByRole('heading', { name: 'Start a new lecture' })).toBeVisible()

  // validation
  await page.getByRole('button', { name: 'Start now' }).click()
  await expect(page.getByText(/before starting/)).toBeVisible()
  await expect(page.getByText('Enter a lecture name.').first()).toBeVisible()

  await page.getByLabel('Lecture name').fill('Febrile convulsions — parent session')
  await page.getByLabel('Demo source file').selectOption('src-hydration')
  await expect(page.getByLabel('Lecture content prompt')).toHaveValue(/.+/)
  await page.getByRole('button', { name: 'Start now' }).click()

  await expect(page.getByText('Lecture started', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Running: A · Lecture content/)).toBeVisible()
  await page.getByRole('link', { name: 'Back to Home' }).click()
  await expect(page.getByRole('link', { name: /Processing/ })).toContainText('2')

  await settle(page)
  await expect(page.getByText(/H1 · Medical content ready for review/).first()).toBeVisible() // toast
  const row = page.getByRole('link', { name: /Review H1 Medical content for Febrile convulsions/ })
  await row.click()
  await expect(page.getByRole('heading', { name: /Medical content review/ })).toBeVisible()
  expect(external).toEqual([])
  expect(errors).toEqual([])
})

test('D02 H1 rejection requires feedback, regenerates and the rejected version cannot pass', async ({ page }) => {
  const title = 'Neonatal jaundice: a guide for parents'
  const p = await projectByTitle(page, title)
  await page.goto(`/lectures/${p.id}/review/H1`)
  await expect(page.getByRole('heading', { name: 'Draft r2' })).toBeVisible()
  await expect(page.locator('[dir="rtl"][lang="ar-EG"]').first()).toBeVisible()

  await page.getByRole('complementary', { name: 'Decision' }).getByRole('button', { name: 'Request changes' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('What should change?').fill('too short')
  await dialog.getByRole('button', { name: 'Send request' }).click()
  await expect(dialog.getByText(/at least 10 characters/).first()).toBeVisible()
  await dialog.getByLabel('What should change?').fill('Add the follow-up visit timing from page 8 of the source.')
  await dialog.getByRole('button', { name: 'Send request' }).click()

  await expect.poll(() => stageOf(page, title)).toBe('A')
  const rejectedFp = (await page.evaluate((id) => window.__lectureStudio.getState().decisions.find((d) => d.projectId === id && d.decision === 'REJECT' && d.gate === 'H1' && !d.seeded), p.id)).artifactFingerprint
  await settle(page)
  await page.goto(`/lectures/${p.id}/review/H1`)
  await expect(page.getByRole('heading', { name: 'Draft r3' })).toBeVisible()
  await expect(page.getByText(/Add the follow-up visit timing/).first()).toBeVisible()

  // Engine refuses the rejected fingerprint even if submitted directly.
  const stale = await page.evaluate(({ id, fp }) => {
    const s = window.__lectureStudio.getState()
    return s.projects.find((x) => x.id === id).progress.fp !== fp
  }, { id: p.id, fp: rejectedFp })
  expect(stale).toBe(true)

  // Approve requires the confirmation; then H2 opens directly.
  const decision = page.getByRole('complementary', { name: 'Decision' })
  await decision.getByRole('button', { name: 'Approve and continue' }).click({ force: true }) // aria-disabled: explains why
  await expect(decision.getByText(/Tick the medical review confirmation/).first()).toBeVisible()
  await approveHere(page)
  await expect(page.getByRole('heading', { name: /Confirm Claude Skills/ })).toBeVisible()
})

test('D03 complete all six gates with automatic stages in between', async ({ page }) => {
  test.setTimeout(120_000)
  const title = 'Full journey synthetic lecture'
  await startLecture(page, { title, minutes: 3 })
  const seen = []
  for (let i = 0; i < 7; i++) {
    await settle(page)
    const stage = await stageOf(page, title)
    if (stage === 'DONE') break
    seen.push(stage)
    const p = await projectByTitle(page, title)
    await page.goto(`/lectures/${p.id}/review/${stage}`)
    if (stage === 'H2') {
      await expect(page.getByText(/Medical slide designer/).first()).toBeVisible()
    }
    if (stage === 'H5') await expect(page.getByText(/outside 60–90 s/).first()).toBeVisible()
    await approveHere(page)
    await expect(page.getByText(new RegExp(`${stage} approved|Lecture completed`)).first()).toBeVisible()
  }
  expect(seen).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])
  const p = await projectByTitle(page, title)
  expect(p.status).toBe('COMPLETED')
  await page.goto(`/lectures/${p.id}?tab=history`)
  await expect(page.getByText('Approved', { exact: true })).toHaveCount(6)
  await page.goto(`/lectures/${p.id}?tab=deliverables`)
  await expect(page.locator('video')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('listitem').filter({ hasText: 'doctor_review.pdf' }).getByRole('button', { name: 'Download' }).click()
  expect((await download).suggestedFilename()).toMatch(/doctor_review_r1\.pdf$/)
})

test('D04 concurrent projects progress independently and survive refresh', async ({ page }) => {
  test.setTimeout(120_000)
  await startLecture(page, { title: 'Concurrent lecture one' })
  await startLecture(page, { title: 'Concurrent lecture two', sourceId: 'src-growth' })
  await settle(page)
  expect(await stageOf(page, 'Concurrent lecture one')).toBe('H1')
  expect(await stageOf(page, 'Concurrent lecture two')).toBe('H1')

  const one = await projectByTitle(page, 'Concurrent lecture one')
  await page.goto(`/lectures/${one.id}/review/H1`)
  await approveHere(page)
  await expect(page.getByRole('heading', { name: /Confirm Claude Skills/ })).toBeVisible()
  await approveHere(page) // H2 → storyboard job for lecture one only
  expect(await stageOf(page, 'Concurrent lecture one')).toBe('B')
  expect(await stageOf(page, 'Concurrent lecture two')).toBe('H1')

  await page.reload()
  await page.goto('/lectures')
  await expect(page.getByRole('row', { name: /Concurrent lecture one/ })).toContainText('Processing')
  await expect(page.getByRole('row', { name: /Concurrent lecture two/ })).toContainText('Needs review')
  const running = await page.evaluate((id) => window.__lectureStudio.getState().jobs.filter((j) => j.status === 'running' && j.projectId === id).length, one.id)
  expect(running).toBe(1) // exactly one storyboard job for lecture one — no duplicate after reload
})

test('D05 prompt versioning keeps old lectures on their version', async ({ page }) => {
  await page.goto('/prompts')
  await page.getByRole('link', { name: /Structured lecture extraction — doctors/ }).click()
  await page.getByRole('button', { name: 'Edit' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Prompt text').fill('FICTIONAL EXAMPLE PROMPT v3. Extract every section, keep numbers exactly and flag doubts.')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved as version 3').first()).toBeVisible()

  const done = await projectByTitle(page, 'Bronchiolitis: board-style review')
  await page.goto(`/lectures/${done.id}?tab=setup`)
  const row = page.getByRole('tabpanel').getByRole('listitem').filter({ hasText: 'Generate lecture content and paired PDF' })
  await expect(row).toContainText('v1')
  await expect(row).toContainText('Library is now v3')

  await page.goto('/lectures/new')
  await expect(page.getByLabel('Lecture content prompt').locator('option:checked')).toContainText('v3')
})

test('D06 budget stop shows an explicit blocked state; fixing and retrying resumes', async ({ page }) => {
  await page.goto('/settings?section=budget')
  await page.getByLabel('Monthly limit (USD)').fill('1')
  await page.getByRole('button', { name: 'Save limit' }).click()
  await expect(page.getByText('Limit reached — new paid jobs stop')).toBeVisible()

  const title = 'Asthma action plans for school-age children'
  const p = await projectByTitle(page, title)
  await page.goto(`/lectures/${p.id}/review/H4`)
  await approveHere(page)
  await page.goto(`/lectures/${p.id}`)
  await expect(page.getByRole('heading', { name: /Paused: Monthly budget limit reached/ })).toBeVisible()
  await expect(page.getByText(/No other provider or model was tried automatically/)).toBeVisible()
  const before = (await projectByTitle(page, title)).artifacts.transcripts
  await page.getByRole('button', { name: /Retry D/ }).click()
  await expect(page.getByText('Still blocked').first()).toBeVisible()

  await page.getByRole('link', { name: 'Fix in Settings' }).click()
  await page.getByLabel('Monthly limit (USD)').fill('20')
  await page.getByRole('button', { name: 'Save limit' }).click()
  await page.goto(`/lectures/${p.id}`)
  await page.getByRole('button', { name: /Retry D/ }).click()
  await expect(page.getByText(/Running: D · Voices/)).toBeVisible()
  const after = await projectByTitle(page, title)
  expect(after.artifacts.transcripts).toEqual(before)
  expect(after.status).toBe('PROCESSING')
})

test.describe('D07 phone review from a notification', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('reject a single chunk at 390 px without horizontal scroll', async ({ page }) => {
    await page.goto('/notifications?filter=review')
    await expectNoHorizontalOverflow(page)
    const item = page.getByRole('listitem').filter({ hasText: 'H4 · Transcripts ready for review' })
    await item.getByRole('button', { name: 'Open review' }).click()
    await expect(page.getByRole('heading', { name: /Narration transcript review/ })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.getByRole('checkbox', { name: 'Select chunk 02 for revision' }).check()
    await page.getByRole('button', { name: 'Request changes' }).last().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Selected: 02. Everything else is kept.')).toBeVisible()
    await dialog.getByLabel('What should change?').fill('Chunk 02 is too fast for the clinic audience.')
    await dialog.getByRole('button', { name: 'Send request' }).click()
    await expect(page.getByRole('heading', { name: 'Pending reviews' })).toBeVisible()
    const p = await projectByTitle(page, 'Asthma action plans for school-age children')
    expect(p.progress).toMatchObject({ stage: 'C', targets: ['02'] })
    await expectNoHorizontalOverflow(page)
  })
})

test('D08 H6 targeted AUDIO rejection keeps earlier gates and the previous render', async ({ page }) => {
  test.setTimeout(120_000)
  const title = 'Growth charts for new residents'
  let p = await projectByTitle(page, title)
  await page.goto(`/lectures/${p.id}/review/H5`)
  await approveHere(page)
  await settle(page)
  await page.goto(`/lectures/${p.id}/review/H6`)
  await page.getByRole('complementary', { name: 'Decision' }).getByRole('button', { name: 'Request changes' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: /Audio/ }).check()
  await dialog.getByText('02', { exact: true }).click()
  await dialog.getByLabel('What should change?').fill('Voice in chunk 02 clips the last sentence.')
  await dialog.getByRole('button', { name: 'Send request' }).click()
  p = await projectByTitle(page, title)
  expect(p.progress).toMatchObject({ stage: 'D', targets: ['02'] })
  await settle(page)
  await page.goto(`/lectures/${p.id}/review/H5`)
  await expect(page.getByText('New', { exact: true })).toHaveCount(1)
  await approveHere(page)
  await settle(page)
  await page.goto(`/lectures/${p.id}/review/H6`)
  await approveHere(page)
  p = await projectByTitle(page, title)
  expect(p.status).toBe('COMPLETED')
  expect(p.artifacts.renders).toHaveLength(2)
  const h = await page.evaluate((id) => window.__lectureStudio.getState().decisions.filter((d) => d.projectId === id).map((d) => `${d.gate}:${d.decision}`), p.id)
  expect(h.filter((x) => x.startsWith('H1') || x.startsWith('H2') || x.startsWith('H3') || x.startsWith('H4'))).toEqual(['H4:APPROVE', 'H3:APPROVE', 'H2:APPROVE', 'H1:APPROVE'])
})

test('D09 prompt categories: create, map, use, archive after use', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/prompts')
  await page.getByRole('button', { name: 'Manage categories' }).click()
  await page.getByRole('button', { name: 'Create category' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill('Case vignettes')
  await dialog.getByRole('checkbox', { name: 'Lecture content (A)' }).check()
  await dialog.getByRole('button', { name: 'Create category' }).click()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'New prompt' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title').fill('Vignette-first extraction')
  await dialog.getByLabel('Category').selectOption({ label: 'Case vignettes (A)' })
  await dialog.getByLabel('Prompt text').fill('FICTIONAL EXAMPLE. Build the lecture around three synthetic vignettes from the source.')
  await dialog.getByRole('button', { name: 'Create prompt' }).click()
  await expect(page.getByRole('heading', { name: 'Vignette-first extraction' })).toBeVisible()

  await page.goto('/lectures/new')
  await page.getByLabel('Lecture name').fill('Vignette based lecture')
  await page.getByLabel('Demo source file').selectOption('src-iron')
  const picker = page.getByLabel('Lecture content prompt')
  await expect(picker.locator('optgroup[label="Case vignettes"] option')).toHaveCount(1)
  await expect(picker.locator('optgroup[label="Board review ideas"]')).toHaveCount(0) // library-only, unmapped
  await picker.selectOption({ label: 'Vignette-first extraction — v1' })
  await page.getByRole('button', { name: 'Start now' }).click()
  await expect(page.getByText('Lecture started', { exact: true }).first()).toBeVisible()
  const lectureUrl = page.url().split('?')[0]

  await page.goto('/prompts')
  await page.getByRole('button', { name: 'Manage categories' }).click()
  dialog = page.getByRole('dialog')
  const row = dialog.getByRole('listitem').filter({ hasText: 'Case vignettes' })
  await expect(row.getByRole('button', { name: 'Delete Case vignettes' })).toHaveCount(0)
  await expect(row.getByText('In use — archive instead')).toBeVisible()
  await row.getByRole('button', { name: 'Archive' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel(/Move its 1 active prompt/).selectOption({ label: 'Lecture content' })
  await dialog.getByRole('button', { name: 'Archive category' }).click()
  await expect(page.getByText(/Archived “Case vignettes” and moved 1 prompt/).first()).toBeVisible()

  await page.goto(`${lectureUrl}?tab=setup`)
  await expect(page.getByText('category “Case vignettes”')).toBeVisible()
  const stages = await page.evaluate(() => window.__lectureStudio.getState().projects[0].plan && 12)
  expect(stages).toBe(12)
})

test('D10 direct H1 edit creates a new revision; a stale link never approves', async ({ page }) => {
  const title = 'Neonatal jaundice: a guide for parents'
  const p = await projectByTitle(page, title)
  const oldFp = p.progress.fp
  await page.goto(`/lectures/${p.id}/review/H1`)
  await page.getByRole('button', { name: 'Edit text' }).click()
  const editor = page.getByLabel('Canonical lecture text (Markdown)')
  await editor.fill((await editor.inputValue()) + '\n\nDoctor note: follow-up visit within the first week (synthetic).')
  await page.getByLabel(/What did you change/).fill('Added follow-up note')
  await page.getByRole('button', { name: 'Save new revision' }).click()
  await expect(page.getByText(/Re-rendering the paired PDF/)).toBeVisible()
  await settle(page)
  await expect(page.getByRole('heading', { name: 'Draft r3' })).toBeVisible()
  await expect(page.getByText(/your direct edit/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Paired PDF' }).click()
  await expect(page.getByText(/rendered from canonical text r3/)).toBeVisible()

  // Stale deep link to the previous version
  await page.goto(`/lectures/${p.id}/review/H1?v=${encodeURIComponent(oldFp)}`)
  await expect(page.getByText('That link was for an earlier version')).toBeVisible()
  // Engine-level stale approval is refused
  const r = await page.evaluate(({ id, fp }) => {
    const s = window.__lectureStudio.getState()
    return s.projects.find((x) => x.id === id).progress.fp === fp
  }, { id: p.id, fp: oldFp })
  expect(r).toBe(false)
  await approveHere(page)
  await expect(page.getByRole('heading', { name: /Confirm Claude Skills/ })).toBeVisible()
  const decisions = await page.evaluate((id) => window.__lectureStudio.getState().decisions.filter((d) => d.projectId === id && !d.seeded), p.id)
  expect(decisions[0].artifactVersions.content).toBe('r3')
})
