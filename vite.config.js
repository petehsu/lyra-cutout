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
        selfHandleResponse: true, // 完全接管响应处理
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // 设置必要的请求头
            proxyReq.setHeader('Origin', 'https://www.bing.com');
            proxyReq.setHeader('Referer', 'https://www.bing.com/images/create');
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0');

            // 从前端自定义头中提取 Cookie
            const bingCookie = req.headers['x-bing-cookie'];
            if (bingCookie) {
              proxyReq.setHeader('Cookie', bingCookie);
            }
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            // 设置 CORS
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', '*');

            // 如果是 302 重定向，拦截并返回 JSON
            if (proxyRes.statusCode === 302 || proxyRes.statusCode === 301) {
              const location = proxyRes.headers['location'];
              let fullLocation = location;
              if (location && location.startsWith('/')) {
                fullLocation = `https://www.bing.com${location}`;
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ redirect: fullLocation }));
            } else {
              // 其他响应正常透传
              res.writeHead(proxyRes.statusCode, proxyRes.headers);
              proxyRes.pipe(res);
            }
          });
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

