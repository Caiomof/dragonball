import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 280
    }
  },
  plugins: [
    {
      name: 'game-full-reload',
      handleHotUpdate({ file, server }) {
        if (/[\\/]src[\\/]/.test(file) || /index\.html$/.test(file)) {
          server.ws.send({ type: 'full-reload' });
          return [];
        }
      }
    }
  ]
});
