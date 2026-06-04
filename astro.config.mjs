import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Integrations
  integrations: [
    sitemap({
      // 排除舊 redirect 頁（它們是 301/meta-refresh，不該進 sitemap）
      filter: (page) => !/\/games\/game-[3-9]\/?$/.test(page) && !/\/articles\/arcade-vs-online\/?$/.test(page) && !/\/articles\/daily-cash-539-wheel-strategy\/?$/.test(page),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],

  // Enable SSR or Static Site Generation
  output: 'static',

  // Site URL for production
  site: 'https://game8la.com',

  // Trailing slash behavior
  trailingSlash: 'always',

  // 301 redirects for renamed game URLs (2026-04-09 SEO: 非描述性 slug → 語意 slug)
  redirects: {
    '/games/game-3/': '/games/dragon-legend/',
    '/games/game-4/': '/games/thor-hammer-2/',
    '/games/game-5/': '/games/mahjong-ways/',
    '/games/game-6/': '/games/god-of-war-lubu/',
    '/games/game-7/': '/games/god-of-wealth/',
    '/games/game-8/': '/games/mahjong-ways-2/',
    '/games/game-9/': '/games/night-market-3/',
    // 2026-04-15 merge duplicate: arcade-vs-online (old) → arcade-vs-online-casino (new)
    '/articles/arcade-vs-online/': '/articles/arcade-vs-online-casino/',
    // 2026-06-04 解 539 自相殘殺：strategy 併入 guide（兩篇打同關鍵字，guide 是流量贏家）
    '/articles/daily-cash-539-wheel-strategy/': '/articles/daily-cash-539-wheel-guide/',
  },

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
