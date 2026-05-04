import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://argobeat.app',
  vite: {
    optimizeDeps: {
      include: ['@argobeat/engine'],
    },
  },
});
