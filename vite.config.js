import { defineConfig } from 'vite';

// Change VITE_BASE_PATH env var (or the fallback string below) to match your GitHub repo name.
// Example: if your repo is github.com/you/NAVigator, set base to '/NAVigator/'
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/NAVigator/',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: {
    // Proxy /amfi-proxy → amfiindia.com so the dev server fetches it server-side
    // (no browser CORS restriction). Production uses VITE_AMFI_PROXY_URL instead.
    proxy: {
      '/amfi-proxy': {
        target: 'https://portal.amfiindia.com',
        changeOrigin: true,
        rewrite: () => '/spages/NAVAll.txt',
        followRedirects: true,
      },
      '/mfapi-proxy': {
        target: 'https://api.mfapi.in',
        changeOrigin: true,
        rewrite: path => path.replace('/mfapi-proxy', ''),
      },
    },
  },
});
