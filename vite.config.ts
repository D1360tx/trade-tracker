import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/mexc-futures': {
        target: 'https://contract.mexc.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mexc-futures/, ''),
      },
      '/api/mexc': {
        target: 'https://contract.mexc.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mexc/, ''),
      },
      '/api/mexc-spot': {
        target: 'https://api.mexc.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mexc-spot/, ''),
      },
      '/api/bybit': {
        target: 'https://api.bybit.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bybit/, ''),
      },
    },
  },
});
