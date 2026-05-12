import { defineConfig } from 'vite';

// Change VITE_BASE_PATH env var (or the fallback string below) to match your GitHub repo name.
// Example: if your repo is github.com/you/my-mf-app, set base to '/my-mf-app/'
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/mutual-lens/',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
