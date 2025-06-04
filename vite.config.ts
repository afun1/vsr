import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
  },
  build: {},
  // Add this for SPA fallback on Vercel/static hosting
  preview: {
    // Vercel serves static files from /, so fallback to index.html for SPA
    // This is for local preview, but Vercel needs vercel.json rewrites (already set)
  },
  // For Vercel static hosting, ensure base is '/'
  base: '/',
})
