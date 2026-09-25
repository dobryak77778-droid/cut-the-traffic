import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base keeps the build portable inside a future Capacitor wrapper.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    // The Arena preview proxies arbitrary hosts; allow them in dev.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
