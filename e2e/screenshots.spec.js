// Captures the documentation screenshots in docs/screenshots (run: pnpm screenshots).
import { test } from '@playwright/test'
import { approveHere, projectByTitle, resetDemo, settle } from './helpers.js'

const OUT = 'docs/screenshots'

async function shot(page, name, { full = true } = {}) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full })
}

async function ids(page) {
  const t = (title) => projectByTitle(page, title).then((p) => p.id)
  return {
    jaundice: await t('Neonatal jaundice: a guide for parents'),
    asthma: await t('Asthma action plans for school-age children'),
    growth: await t('Growth charts for new residents'),
    vaccines: await t('What to expect at a vaccination visit'),
    done: await t('Bronchiolitis: board-style review'),
    iron: await t('Iron-deficiency anaemia: a case-based review'),
    draft: await t('Oral rehydration at home'),
  }
}

const DESKTOP = [[1440, 900], [1280, 800]]

for (const [w, h] of DESKTOP) {
  test(`desktop screens ${w}x${h}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: w, height: h })
    await resetDemo(page)
    const id = await ids(page)
    const s = (n) => `${w}-${n}`
    await shot(page, s('01-home'), { full: false })
    await shot(page, s('01-home-full'))
    await page.goto('/lectures'); await shot(page, s('02-lectures'))
    await page.goto('/lectures/new'); await shot(page, s('03-new-lecture'))
    await page.getByRole('button', { name: 'Change preferences' }).click(); await shot(page, s('03b-new-lecture-preferences'))
    await page.goto('/reviews'); await shot(page, s('04-pending-reviews'))
    await page.goto(`/lectures/${id.jaundice}/review/H1`); await shot(page, s('05-h1-medical-content-rtl'), { full: false })
    await page.getByRole('button', { name: 'Paired PDF' }).click(); await shot(page, s('05b-h1-paired-pdf'), { full: false })
    await page.goto(`/lectures/${id.asthma}/review/H4`); await shot(page, s('08-h4-transcripts'), { full: false })
    await page.goto(`/lectures/${id.growth}/review/H5`); await shot(page, s('09-h5-audio'))
    await page.goto(`/lectures/${id.vaccines}`); await shot(page, s('11-lecture-blocked'))
    await page.goto(`/lectures/${id.done}?tab=deliverables`); await shot(page, s('12-deliverables'))
    await page.goto(`/lectures/${id.done}?tab=history`); await shot(page, s('13-approval-history'))
    await page.goto(`/lectures/${id.done}?tab=setup`); await shot(page, s('14-prompt-snapshots'))
    await page.goto('/prompts'); await shot(page, s('15-master-prompts'))
    await page.getByRole('button', { name: 'Manage categories' }).click(); await shot(page, s('16-prompt-categories'), { full: false })
    await page.keyboard.press('Escape')
    await page.goto(`/prompts/${(await projectByTitle(page, 'Asthma action plans for school-age children')).promptRefs.A.promptId}`); await shot(page, s('17-prompt-versions'))
    await page.goto('/skills'); await shot(page, s('18-claude-skills'))
    await page.goto('/notifications'); await shot(page, s('19-notifications'))
    await page.goto('/settings?section=providers'); await shot(page, s('20-settings-providers'))
    await page.goto('/settings?section=budget'); await shot(page, s('21-settings-budget'))
    await page.goto('/settings?section=notifications'); await shot(page, s('22-settings-notifications'))
    await page.goto('/settings?section=demo'); await shot(page, s('23-settings-demo'))

    // Drive the Arabic lecture forward for H2, H3 and H6 screens
    await page.goto(`/lectures/${id.jaundice}/review/H1`)
    await approveHere(page)
    await shot(page, s('06-h2-skills'))
    await approveHere(page)
    await settle(page)
    await page.goto(`/lectures/${id.jaundice}/review/H3`); await shot(page, s('07-h3-storyboard'), { full: false })
    await page.goto(`/lectures/${id.jaundice}`); await shot(page, s('10-lecture-detail-review'), { full: false })
    await page.goto(`/lectures/${id.growth}/review/H5`); await approveHere(page); await settle(page)
    await page.goto(`/lectures/${id.growth}/review/H6`); await shot(page, s('10b-h6-final-video'))
    await page.getByRole('complementary', { name: 'Decision' }).getByRole('button', { name: 'Request changes' }).click()
    await page.getByRole('dialog').getByRole('radio', { name: /Audio/ }).check()
    await shot(page, s('10c-h6-request-changes'), { full: false })
    await page.keyboard.press('Escape')
    await resetDemo(page, { empty: true })
    await shot(page, s('24-empty-first-run'), { full: false })
  })
}

const MOBILE = [[390, 844], [320, 640], [768, 1024]]
for (const [w, h] of MOBILE) {
  test(`responsive screens ${w}x${h}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: w, height: h })
    await resetDemo(page)
    const id = await ids(page)
    const s = (n) => `${w}-${n}`
    await shot(page, s('01-home'))
    await page.goto('/lectures'); await shot(page, s('02-lectures'), { full: false })
    await page.goto('/lectures/new'); await shot(page, s('03-new-lecture'))
    await page.goto(`/lectures/${id.jaundice}/review/H1`); await shot(page, s('05-h1-review'), { full: false })
    await page.goto(`/lectures/${id.asthma}/review/H4`); await shot(page, s('08-h4-review'), { full: false })
    await page.goto(`/lectures/${id.growth}/review/H5`); await shot(page, s('09-h5-review'), { full: false })
    await page.goto('/prompts'); await shot(page, s('15-prompts'), { full: false })
    await page.goto('/settings?section=budget'); await shot(page, s('21-settings-budget'), { full: false })
    await page.goto('/notifications'); await shot(page, s('19-notifications'), { full: false })
    if (w < 768) {
      await page.goto('/')
      await page.getByRole('button', { name: 'Open navigation menu' }).click()
      await shot(page, s('00-navigation'), { full: false })
    }
  })
}
