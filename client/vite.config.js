import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    // VITE_BASE_PATH is set to '/dispatch/' in CI build; defaults to '/' for local dev
                              base: process.env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
          port: 5173,
          proxy: {
                  '/api': {
                            target: 'http://localhost:3001',
                            changeOrigin: true,
                  },
          },
    },
    build: {
          outDir: 'dist',
          emptyOutDir: true,
    },
});
