import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'env-checker',
      configureServer() {
        console.log('Environment variables:', process.env);
      },
    },
    react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    },
  },
  server: {
    https: fs.existsSync('./certificates/cert.pem') ? {
      key: './certificates/key.pem',
      cert: './certificates/cert.pem'
    } : undefined,
    proxy: {
      '/api/intercom': {
        target: 'https://api.eu.intercom.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/intercom/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
          });
        }
      }
    }
  },
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
