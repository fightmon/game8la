import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * 不進 sitemap 的網址，分三類：
 *  (1) 301／meta-refresh 轉址頁（舊 slug）
 *  (2) 後台頁面——不該出現在給搜尋引擎的清單裡
 *  (3) 帶 noindex 的頁面：純遊戲畫面與模擬器。排名集中在對應的 /games/ 落地頁，
 *      避免同一組關鍵字自相殘殺（大樂透那組就是這樣互打過）
 */
const SITEMAP_EXCLUDE = [
  // (1) 轉址頁
  /\/games\/game-[3-9]\/?$/,
  /\/articles\/arcade-vs-online\/?$/,
  /\/articles\/daily-cash-539-wheel-strategy\/?$/,
  // (2) 後台
  /\/admin\//,
  // (3) noindex 頁面
  /\/games\/taiwan-mahjong\/play\/?$/,
  /\/tools\/(slot|thor-hammer-2|baphomet|lu-bu)-simulator\/?$/,
  /\/tools\/blackjack\/?$/,
  /\/tools\/power-lottery-calculator\/?$/,
  /\/articles\/capcomcup-12-sahara-champion\/?$/,
  /\/caseDemo\//,
];

export default defineConfig({
  // Integrations
  integrations: [
    sitemap({
      // ⚠️ 鐵則：sitemap 不可以收錄 noindex 或會轉址的頁面。
      // 兩者放進 sitemap 等於「主動提交、又叫 Google 別收」，GSC 會報
      // 「已提交的網址標記為 noindex」，浪費檢索預算也稀釋網站訊號。
      // 新增 noindex 頁面時，記得同步加進 SITEMAP_EXCLUDE。
      filter: (page) => !SITEMAP_EXCLUDE.some((re) => re.test(page)),
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
