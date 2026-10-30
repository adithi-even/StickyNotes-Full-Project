import { defineConfig } from 'vite';
export default defineConfig({
  root: 'web',
  server: { host: true },
  build: { outDir: '../web-dist', emptyOutDir: true }
});