import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/email-preferences': {
        target: 'https://europe-west1-real-estate-idealista-bot.cloudfunctions.net',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/email-preferences/, '/emailPreferencesApi'),
      },
      '/api/email-unsubscribe': {
        target: 'https://europe-west1-real-estate-idealista-bot.cloudfunctions.net',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/email-unsubscribe/, '/emailUnsubscribe'),
      },
    },
  },
})
