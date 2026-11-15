import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → fonctionne sur GitHub Pages / Netlify / Vercel sans configuration
export default defineConfig({
  plugins: [react()],
  base: './',
  // dev: the NIRAN server (node server/index.mjs) answers /api
  server: { proxy: { '/api': 'http://localhost:8787' } },
  build: { chunkSizeWarningLimit: 700, rollupOptions: { output: { manualChunks: { charts: ['recharts'], react: ['react', 'react-dom', 'zustand'] } } } },
});
