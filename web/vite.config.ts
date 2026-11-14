import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → fonctionne sur GitHub Pages / Netlify / Vercel sans configuration
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 700, rollupOptions: { output: { manualChunks: { charts: ['recharts'], react: ['react', 'react-dom', 'zustand'] } } } },
});
