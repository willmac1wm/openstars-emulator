import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  optimizeDeps: {
    exclude: ['kokoro-js', '@huggingface/transformers', 'onnxruntime-web', 'phonemizer'],
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['services/**/*.test.ts'],
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