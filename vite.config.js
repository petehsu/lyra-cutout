import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy rembg local server to avoid CORS in dev
      '/rembg': {
        target: 'http://localhost:7000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rembg/, ''),
      },
      // Proxy Adobe Sensei API
      '/adobe-api': {
        target: 'https://sensei.adobe.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/adobe-api/, ''),
        headers: {
          'Origin': 'https://quick-actions.express.adobe.com',
          'Referer': 'https://quick-actions.express.adobe.com/',
        },
      },
      // Bing Image Creator Proxy
      '/bing-proxy': {
        target: 'https://www.bing.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bing-proxy/, ''),
        headers: {
          'Origin': 'https://www.bing.com',
          'Referer': 'https://www.bing.com/images/create',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
        },
        cookieDomainRewrite: {
          '*': ''
        }
      },
      // Proxy Adobe Token API
      '/adobe-token': {
        target: 'https://adobeid-na1.services.adobe.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/adobe-token/, ''),
        headers: {
          'Origin': 'https://quick-actions.express.adobe.com',
          'Referer': 'https://quick-actions.express.adobe.com/',
        },
      },
    },
  },
});

