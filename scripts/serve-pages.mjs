// Local stand-in for GitHub Pages: serves dist/ under /lecture-studio/ and, like Pages,
// answers unknown paths with dist/404.html and HTTP 404. Used to test the Pages build.
// Usage: node scripts/serve-pages.mjs [port=4174]
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.argv[2] || 4174)
const base = '/lecture-studio/'
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4', '.vtt': 'text/vtt', '.json': 'application/json',
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  let path = decodeURIComponent(url.pathname)
  if (!path.startsWith(base)) path = null
  else {
    path = normalize(join(dist, path.slice(base.length)))
    if (!path.startsWith(dist)) path = null
    else if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
  }
  const found = path && existsSync(path) && statSync(path).isFile()
  const file = found ? path : join(dist, '404.html')
  res.writeHead(found ? 200 : 404, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`GitHub Pages emulator: http://127.0.0.1:${port}${base}`))
