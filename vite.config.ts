import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
      },
      preload: {
        input: 'electron/preload.ts',
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
  // Proxy /v1 requests to fm serve in browser dev mode (avoids CORS)
  server: {
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:8462',
        changeOrigin: true,
      },
    },
  },
})
