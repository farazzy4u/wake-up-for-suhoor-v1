import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/wake-up-for-suhoor/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
