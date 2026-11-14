import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → fonctionne sur GitHub Pages / Netlify / Vercel sans configuration
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
