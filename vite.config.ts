import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/wake-up-for-suhoor-v1/',  // Update base for GitHub Pages
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    copyPublicDir: true,
    modulePreload: {
      polyfill: true
    },
    rollupOptions: {
      input: {
        main: 'index.html'
      },
      output: {
        format: 'es',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
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
      '@': 'src',
    },
  }
});
