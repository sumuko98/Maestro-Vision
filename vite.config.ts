import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  server: {
    host: '127.0.0.1', port: 3000, strictPort: true,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: { ignored: ['**/.baseline/**', '**/.npm-cache/**', '**/reports/**',
      '**/test-results/**', '**/playwright-report/**'] },
  },
});


