import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Integrations
  integrations: [sitemap()],

  // Enable SSR or Static Site Generation
  output: 'static',

  // Site URL for production
  site: 'https://game8la.com',

  // Trailing slash behavior
  trailingSlash: 'always',

  // Build configuration
  build: {
    format: 'directory',
  },

  // Image optimization
  image: {
    domains: ['game8la.com'],
  },

  // Vite configuration
  vite: {
    ssr: {
      external: ['svgo'],
    },
  },
});
