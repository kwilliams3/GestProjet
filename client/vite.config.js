import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En développement, les appels /api sont redirigés vers le serveur Node.
    proxy: { '/api': 'http://[::1]:4000' },
  },
});

