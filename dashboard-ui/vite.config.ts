import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  // When building, output to the Express static folder
  build: {
    outDir: resolve(__dirname, '../public/admin'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  // In dev mode, proxy API calls to Express (port 3000)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        headers: {
          Authorization: 'Basic ' + Buffer.from('admin:admin123').toString('base64'),
        },
      },
    },
  },
  base: '/admin/',
});
