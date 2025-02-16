import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/wake-up-for-suhoor-v1/' : '',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    copyPublicDir: true
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
    fs: {
      strict: true,
      allow: ['..']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  }
});
