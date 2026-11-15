import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → fonctionne sur GitHub Pages / Netlify / Vercel sans configuration
export default defineConfig({
  plugins: [react()],
  base: './',
  // dev: the NIRAN server (node server/index.mjs) answers /api
  server: { proxy: { '/api': 'http://localhost:8787' } },
  // No manualChunks: splitting recharts from react made the two chunks import each
  // other (shared CJS helpers), so `charts` evaluated before React → blank page in prod.
  build: { chunkSizeWarningLimit: 1200 },
});
