import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Public path. Local development serves from '/'. The GitHub Pages build sets
// VITE_BASE_PATH=/lecture-studio/ (project site at https://<user>.github.io/lecture-studio/).
// An absolute base (not './') is required because the app uses client-side routes such as
// /lectures/:id/review/H1, where relative asset URLs would resolve against the nested path.
const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  // Scan every source file up front so lazily-loaded routes never trigger a mid-session
  // dependency re-optimisation (which can load two React copies in dev).
  optimizeDeps: { entries: ['index.html', 'src/**/*.{js,jsx}', '!src/**/*.test.js'] },
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
  },
})
