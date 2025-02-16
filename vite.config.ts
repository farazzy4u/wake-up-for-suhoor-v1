import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use different base paths for dev and prod
  base: command === 'serve' ? '/' : '/wake-up-for-suhoor-v1/',
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
    middlewareMode: false
  },
  resolve: {
    alias: {
      '@': 'src',
    },
  }
}));
