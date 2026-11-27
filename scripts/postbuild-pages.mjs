// Prepares dist/ for GitHub Pages (static hosting with client-side routes):
//  - 404.html is a copy of index.html, so a refresh or a direct link to a nested route
//    (e.g. /lecture-studio/lectures/lec_005/review/H1) loads the app, and React Router
//    renders the right screen from the URL.
//  - .nojekyll tells Pages to serve files as they are (no Jekyll processing).
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'

const dist = new URL('../dist/', import.meta.url)
if (!existsSync(new URL('index.html', dist))) throw new Error('dist/index.html not found — run the build first')
copyFileSync(new URL('index.html', dist), new URL('404.html', dist))
writeFileSync(new URL('.nojekyll', dist), '')
console.log('GitHub Pages: wrote dist/404.html and dist/.nojekyll')
