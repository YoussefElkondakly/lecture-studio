// Renders labelled title cards for the synthetic sample video (used by generate-samples.sh).
import { chromium } from '@playwright/test'

const out = process.argv[2]
const cards = [
  ['Lecture Studio', 'Synthetic final video sample'],
  ['Scene S02', 'Learning objectives — placeholder frame'],
  ['Scene S03', 'Diagram slide — placeholder frame'],
  ['Summary', 'Prototype output · not medical guidance'],
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
for (const [i, [title, sub]] of cards.entries()) {
  await page.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:720px;background:#153C63;color:#fff;font-family:Georgia,serif;position:relative;overflow:hidden">
    <div style="position:absolute;top:40px;left:48px;font:600 20px/1 -apple-system,Helvetica,sans-serif;letter-spacing:.02em;color:#C5D3E0">Synthetic sample — not a real lecture render</div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px">
      <div style="font-size:64px;font-weight:600">${title}</div>
      <div style="font:400 30px/1.3 -apple-system,Helvetica,sans-serif;color:#C5D3E0">${sub}</div>
    </div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:18px;background:#087F76"></div>
    <div style="position:absolute;right:48px;bottom:44px;font:600 22px -apple-system,Helvetica,sans-serif;color:#C5D3E0">${i + 1} / ${cards.length}</div>
  </body></html>`)
  await page.screenshot({ path: `${out}/card${i + 1}.png` })
}
await browser.close()
