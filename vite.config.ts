import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isDesktop = process.env.VITE_OPENSTARS_DESKTOP === '1';

// https://vitejs.dev/config/
export default defineConfig({
  clearScreen: false,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'voice-cache-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && (req.url.startsWith('/voice/') || req.url === '/voice-sw.js')) {
            if (req.url.startsWith('/voice/')) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
              res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            }
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: isDesktop
      ? {
          // Desktop installer must not embed eSpeak NG (GPL-3.0).
          phonemizer: path.resolve(rootDir, 'services/phonemizerDesktopShim.ts'),
        }
      : {},
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  optimizeDeps: {
    exclude: ['kokoro-js', '@huggingface/transformers', 'onnxruntime-web', 'phonemizer'],
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['services/**/*.test.ts', 'sim/**/*.test.ts', 'components/**/*.test.tsx'],
  },
  // FIX: Esbuild must be here at the root, NOT inside the build object
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    sourcemap: false,
    minify: 'esbuild',
    // Tauri expects a relative base for asset:// loading.
    ...(isDesktop ? { target: ['es2021', 'chrome100', 'safari14'] } : {}),
  },
  // Desktop: do not copy public/voice ONNX into the sealed .app (codesign hang).
  // Kokoro/Whisper web assets warm from network/cache; native Whisper uses app data.
  ...(isDesktop ? { publicDir: false as const } : {}),
});
