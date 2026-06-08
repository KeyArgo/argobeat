import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://beat.argobox.com',
  server: { host: '0.0.0.0' },
  vite: {
    optimizeDeps: {
      include: ['@argobeat/engine'],
    },
  },
});
