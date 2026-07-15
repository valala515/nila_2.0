import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Дев-сервер проксирует /api на dashboardApi.ts (см. src/transport/dashboardApi.ts,
// DASHBOARD_PORT в .env) — в проде это один и тот же процесс/порт, прокси не нужен.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
  },
});
