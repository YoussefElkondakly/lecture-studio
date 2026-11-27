import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
