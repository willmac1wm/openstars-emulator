import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Polyfill process.env for the existing code usage
    'process.env': process.env
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  // FIX: Esbuild must be here at the root, NOT inside the build object
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
  }
});