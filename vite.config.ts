import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy cho đường dẫn API nội bộ khi chạy local
      '/api/proxy': {
        target: 'http://localhost:3000', // Sẽ được xử lý bởi logic fallback trong code hoặc mock
        bypass: (req, res, options) => {
            // Khi chạy npm run dev thuần túy (không có backend node), 
            // proxy này chỉ mang tính định nghĩa. 
            // Code frontend sẽ tự fallback nếu call vào /api/proxy thất bại (404/500).
            return req.url;
        }
      },
      // Giữ lại proxy cũ cho legacy support
      '/zalo-api': {
        target: 'https://openapi.zalo.me',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zalo-api/, ''),
      },
    },
  },
});