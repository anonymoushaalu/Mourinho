import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Only VITE_-prefixed vars reach the bundle; this read is build-time only.
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@mourinho/shared': fileURLToPath(new URL('../shared/src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      // Dev requests go same-origin through this proxy, so the browser never
      // makes a cross-origin call and CORS stays out of the dev loop entirely.
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      target: 'es2022',
    },
  };
});
