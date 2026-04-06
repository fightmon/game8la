# GAME8LA Astro SSG Conversion

This is the converted Astro Static Site Generation version of the GAME8LA website.

## Project Structure

```
src/
├── components/
│   ├── NavBar.astro
│   ├── FooterBar.astro
│   ├── ScrollToTop.astro
│   └── ShareButtons.astro
├── layouts/
│   ├── BaseLayout.astro
│   └── ArticleLayout.astro
├── styles/
│   └── global.css
└── pages/
    ├── index.astro
    ├── game-detail-1.astro through game-detail-9.astro
    ├── article-baccarat.astro
    ├── article-slots.astro
    ├── article-dealers.astro
    ├── game-ranking.astro
    ├── privacy.astro
    ├── terms.astro
    ├── disclaimer.astro
    └── 404.astro
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Key Changes from Static HTML

- All pages now use `BaseLayout.astro` for consistent header, footer, and navigation
- Image paths have been updated from `images/` to `/images/` for absolute paths
- Internal links have been converted from `.html` files to clean URLs (e.g., `/game-detail-1/`)
- Navigation links now use the correct routing structure
- Google Analytics 4 is integrated in the BaseLayout
- Font Awesome CDN is loaded in the base layout
- All page-specific styles and scripts are preserved

## Image Paths

The conversion fixed the following image path issues:

- Logo: `/images/index/game8la_logo_21x9.webp`
- Favicon: `/images/index/favicon_32x32.webp`
- Page images: `/images/page/*`
- Seth2 game images: `/images/seth2/*`

## Deployment

This project is configured for Cloudflare Pages. The `astro.config.mjs` is set for static output with proper URL structure for clean URLs without trailing slashes.

To deploy:
1. Build the project: `npm run build`
2. Upload the `dist/` directory to your hosting

## Notes

- All navbar functionality has been extracted to `NavBar.astro` with the search modal
- Footer with 4-column layout is in `FooterBar.astro`
- Scroll-to-top button is in `ScrollToTop.astro`
- Share buttons component is available for use in articles
- CSS custom variables are defined globally for theming
