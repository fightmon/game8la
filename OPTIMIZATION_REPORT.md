# GAME8LA 站點優化評估報告

> **稽核日期**：2026-05-09
> **稽核範圍**：`Desktop/case/game8la-astro` 完整 repo（src / public / dist / astro.config / workers）
> **稽核人**：Claude（Anthropic）
> **目的**：盤點現況、列出可優化項目、給出執行優先序

---

## 一、執行摘要 TL;DR

整體評語：**站做得不錯**。積極維護（30 天內 30+ commits）、SEO 該做的都齊、安全 headers 紮實、效能優化已動了好幾刀。但仍有明顯空間：

- **約 7-8 MB 的舊 PNG 殘檔可立即刪除**（節省 dist 體積、加速部署）
- **20+ 篇文章違反 `<style is:global>` 禁令**（README 已寫但實作未跟上，造成維護負債）
- **6 張過肥 WebP 可再壓 ~3 MB**
- **GA4 `gtag()` 沒掛 window**（潛在事件追蹤 bug）
- **第三方 script / 重元件全站載入**（DailyFortune、Newsletter、ReadingProgress）

執行 P0 那 4 件事預估可：
- dist 體積 44 MB → ~33 MB（**省 25%**）
- 修一個既有 GA4 bug
- 文章維護成本下降一半（CSS 不再各自為政）

---

## 二、已完成的優化（值得肯定的部分）

### 2.1 效能

| 項目 | 狀態 |
|---|---|
| GA4 lazy-load（互動或 4 秒後） | ✅ |
| Microsoft Clarity lazy-load（requestIdleCallback） | ✅ |
| Hero banner `<link rel="preload">` + `fetchpriority="high"` | ✅ |
| 全站 image `loading="lazy"` + 寫死 width/height | ✅ |
| Image / CSS / JS / WebP / WOFF2 都 immutable cache 1 年 | ✅ |
| 542 / 552 張圖已 WebP（98%） | ✅ |
| Preconnect to GTM / Clarity | ✅ |

### 2.2 SEO

| 項目 | 狀態 |
|---|---|
| `@astrojs/sitemap` 整合，自動產 sitemap-index + sitemap-0 | ✅ |
| robots.txt allow all + sitemap 指向 | ✅ |
| canonical / OG / Twitter card 全頁齊 | ✅ |
| schema.org Organization（全站） | ✅ |
| WebSite + SearchAction（首頁專屬） | ✅ |
| FaqSchema / ArticleSchema 元件化 | ✅ |
| 7 個 301 redirect（game-3..9 → 語意 slug、arcade-vs-online 合併） | ✅ |
| GSC 驗證 + Sitemap 已提交（30 頁） | ✅ |
| GA4 連接（G-DN9QHEM3GQ） | ✅ |

### 2.3 安全

| 項目 | 狀態 |
|---|---|
| HSTS preload | ✅ |
| X-Frame-Options DENY | ✅ |
| X-Content-Type-Options nosniff | ✅ |
| Referrer-Policy strict-origin-when-cross-origin | ✅ |
| Permissions-Policy 鎖死 camera/mic/geo/payment | ✅ |
| Cross-Origin-Opener-Policy same-origin | ✅ |
| CSP 完整（含 Trusted Types） | ✅ |

### 2.4 架構

| 項目 | 狀態 |
|---|---|
| Astro SSG + Cloudflare Workers Static Assets | ✅ 對的選擇 |
| `global.css` 400 行集中管理 | ✅ |
| `articles.js` 統一文章資料源（首頁 + /articles/ 列表自動同步） | ✅ |
| Cloudflare Worker `/api/lottery` proxy（caches.default + 600s TTL） | ✅ |
| 額外 workers（api / lottery-cron / tg-bot）模組化 | ✅ |
| `trailingSlash: 'always'` 統一 URL 規範 | ✅ |
| `PROJECT_CONTEXT.md` 寫得詳細 | ✅ 業界少見的好習慣 |

---

## 三、P0 立即修正（高 CP 值，建議本週完成）

### 🔴 P0-1：刪除約 7-8 MB 舊 PNG 殘檔

`/public/images/index/` 與 `/public/images/fantasy-potion/` 內這些 PNG **全部 0 references in src/**（grep 確認），webp 版本都已存在並取代之：

| 檔案 | 大小 | 處置建議 |
|---|---|---|
| `index/game8laLogo_1X1.png` | **2.3 MB** | ❌ 刪除（0 refs） |
| `index/indexBanner001_01.png` | **1.7 MB** | ❌ 刪除（webp 才是 preload 來源） |
| `index/game8la_logo_21x9.png` | **1.6 MB** | ⚠️ 保留但**重壓到 < 50 KB**（email template 引用，但 1.6 MB 太誇張） |
| `index/indexBanner001_bg.png` | **1.4 MB** | ❌ 刪除 |
| `index/apple-touch-icon_180x180.png` | — | ❌ 刪除（webp 才是 BaseLayout 引用） |
| `index/favicon_32x32.png` | — | ❌ 刪除（同上） |
| `index/icon-192.png` | — | ❌ 刪除（同上） |
| `fantasy-potion/Fantasy-potion.png` | **752 KB** | ❌ 刪除（webp 版已存在） |
| `fantasy-potion/symbol8.png` | — | ❌ 刪除 |

**預期收益**：dist 從 44 MB → 約 36 MB，部署速度與 R2 / Workers Static Assets 流量都改善。

**執行**：
```bash
# 確認 git 狀態乾淨後
cd public/images
rm index/game8laLogo_1X1.png \
   index/indexBanner001_01.png \
   index/indexBanner001_bg.png \
   index/apple-touch-icon_180x180.png \
   index/favicon_32x32.png \
   index/icon-192.png \
   fantasy-potion/Fantasy-potion.png \
   fantasy-potion/symbol8.png

# game8la_logo_21x9.png 重壓（保留 .png 為 email 用）
# 用 sharp / imagemagick 壓到 < 50 KB
```

---

### 🔴 P0-2：清掉 20+ 文章中的 `<style is:global>`

`PROJECT_CONTEXT.md` 第 86 行明文：
> 「**不要在文章檔裡再放 `<style is:global>` 區塊，會造成重複**」

但 grep 結果顯示以下 20 篇仍違反規則：

```
src/pages/articles/5-tips-spot-casino-scam.astro
src/pages/articles/anti-scam-8la-guide.astro
src/pages/articles/arcade-vs-online-casino.astro
src/pages/articles/at99-blocked-analysis.astro
src/pages/articles/atg-seth-copycat-exposed.astro
src/pages/articles/baccarat-winning-strategy.astro
src/pages/articles/cash-vs-credit-casino-guide.astro
src/pages/articles/casino-beginner-guide.astro
src/pages/articles/casino-jackpot-tax-guide.astro
src/pages/articles/casino-not-recommended-by-casinos.astro
src/pages/articles/casino-payout-guide.astro
src/pages/articles/daily-cash-539-wheel-guide.astro
src/pages/articles/daily-cash-539-wheel-strategy.astro
src/pages/articles/domain-hopping-scam-truth.astro
src/pages/articles/free-credit-guide.astro
src/pages/articles/game8la-manifesto.astro
src/pages/articles/lottery-data-tool-guide.astro
src/pages/articles/lottery-dragout-guide.astro
src/pages/articles/lottery-odds-comparison.astro
（其他 articles/ 下的文章亦待掃描）
```

**問題**：
- 每篇 build 後 HTML 內嵌 100-300 行重複 CSS → 用戶頁面變大
- 改 `global.css` 後文章看到的還是舊 inline → ghost-debug 地獄
- 規則衝突：article-specific 的 selector 可能蓋掉 / 被蓋掉 global

**建議做法**：
1. 先掃一遍每篇 inline 寫了什麼（utility script `grep -A 200 "<style is:global>" articles/*.astro`）
2. 抽出共用 pattern → 合併進 `global.css`
3. 留下真的只屬於該篇的、改成 scoped（不加 `is:global`）
4. 之後新文章 SOP **強制 code review** 不准再加 `is:global`

**預期收益**：每篇文章 HTML 縮小 5-15 KB、CSS 維護成本顯著下降。

---

### 🔴 P0-3：重壓 6 張過肥 WebP（省 ~3 MB）

| 檔案 | 目前 | 建議目標 |
|---|---|---|
| `article-hero/online-casino-guide-hero.webp` | 948 KB | < 130 KB |
| `articles/casino-beginner-turnover.webp` | 656 KB | < 100 KB |
| `articles/casino-beginner-redflags.webp` | 652 KB | < 100 KB |
| `article-hero/live-casino-guide-hero.webp` | 632 KB | < 130 KB |
| `article-hero/live-casino-wifi-warning.webp` | 632 KB | < 100 KB |
| `articles/casino-beginner-cover.webp` | 604 KB | < 100 KB |

**做法**：
```bash
# 用 sharp / cwebp，建議 quality 75-80、resize 到實際渲染尺寸
# 例如 hero 1200×675、cover 800×450
cwebp -q 78 -resize 1200 675 input.webp -o output.webp
```

**注意**：壓完肉眼看一遍、確認沒過糊。若是含字的圖，q 85 比較安全。

---

### 🔴 P0-4：修 `gtag()` 沒掛 window 的 bug

`src/layouts/BaseLayout.astro` 第 58-77 行：

```js
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
(function(){
  // ... lazy load wrapper
})();
```

**問題**：`gtag` 函式定義在 script tag 的 top-level，理論上是 global，**但因為這個 inline script 是 module 還是 script 取決於 Astro 內部處理；保險起見要顯式掛上 window**。

否則之後其他元件（NewsletterCTA / ToolBox / ScrollToTop）想 fire 事件時：
```js
gtag('event', 'cta_click', {...});  // 可能 ReferenceError
```
會壞掉、而且不會在 console 噴錯（因為被 try-catch 吃掉的話）。

**修法**：
```js
window.dataLayer = window.dataLayer || [];
window.gtag = function gtag(){window.dataLayer.push(arguments);};
```

---

## 四、P1 中期優化（兩週內安排）

### 🟡 P1-1：改用 Astro `<Image>` 元件（取代 raw `<img>`）

現況：所有 `<img src="/images/...">` 都是字串路徑、**Astro 編譯時不知道、無法優化**。

改成 `import` + `<Image>` 之後：
- ✅ 自動產 AVIF（再省 25-30%）+ WebP fallback
- ✅ 自動 responsive `srcset`（手機載 480px、桌機 1200px、Retina 1600px）
- ✅ 自動 content-hash 命名（cache-busting 自動化、不用每次手動改檔名）
- ✅ 自動帶 width/height（防 CLS 不用手動寫）

**範例改寫**：

```astro
<!-- Before (current) -->
<img src="/images/seth2/seth2-card-thumbnail.webp" alt="戰神賽特2" loading="lazy" width="600" height="600" />

<!-- After -->
---
import { Image } from 'astro:assets';
import seth2Thumb from '../../assets/games/seth2/seth2-card-thumbnail.webp';
---
<Image src={seth2Thumb} alt="戰神賽特2" widths={[400, 600, 800]} sizes="(max-width: 600px) 100vw, 600px" loading="lazy" />
```

**注意**：data 驅動的圖（`articles.js` 的 `thumbnail` 欄位）需要重構為 import 物件（用 `import.meta.glob` + 動態解析）。建議**分階段執行**：

1. 先動 hero / cover 圖（出現次數少、改起來簡單）
2. 再動 article 列表 thumbnail（要動 `articles.js` schema）
3. 最後動 game pages 的 symbol / feature 圖

**預期收益**：手機端 LCP 改善 0.3-0.8 秒、整體頁面下載量降 30-40%。

---

### 🟡 P1-2：DailyFortune 元件改成按需載入

`DailyFortune.astro` 24 KB（CSS + JS + 抽籤資料）目前**每頁都載**。實際上多數使用者不會點。

**改法選項**：

A. **拆 lazy import**：
```astro
<button id="fortuneBtn">今日運勢</button>
<script>
  document.getElementById('fortuneBtn').addEventListener('click', async () => {
    const { mount } = await import('/scripts/daily-fortune.js');
    mount();
  }, { once: true });
</script>
```

B. **抽 JS 到 `/scripts/daily-fortune.js`、CSS 到 `/styles/daily-fortune.css`**，只在 button 第一次 hover 或 click 時 fetch。

**預期收益**：每頁減 ~20 KB JS 解析量，TBT (Total Blocking Time) 降低。

---

### 🟡 P1-3：Newsletter Benchmark script 改條件載入

`BaseLayout.astro` 第 163 行：
```html
<script async src="https://forms.us.benchmarksend.com/assets/embed.js"></script>
```

雖然 `async`，但仍然每頁都會發外部 request（DNS / TLS / 下載）。**只有實際渲染 `NewsletterCTA` 的頁面才需要這條 script**。

**改法**：把這 `<script>` 從 `BaseLayout.astro` 移到 `NewsletterCTA.astro` 元件內部。沒渲染元件的頁面就不會載。

---

### 🟡 P1-4：CSP 移除 `'unsafe-inline'`（改 hash-based）

目前 `_headers`：
```
script-src 'self' 'unsafe-inline' https://...
```

`'unsafe-inline'` 等於 CSP 對 XSS 沒有保護。BaseLayout 有 4-5 個 inline script（GA / Clarity / FAQ accordion / Organization schema），這些都是固定內容，可改 hash 制：

**做法**：
1. 算每個 inline script 的 sha256 hash
2. 加進 CSP：`script-src 'self' 'sha256-XXXXX...' 'sha256-YYYYY...' https://...`
3. 每次改 inline script 要 rebuild hash（建議寫個 build-time 腳本自動算）

**或更簡單**：改用 Cloudflare Workers 動態注入 nonce（每 request 不同 nonce），inline script 加 `nonce="{$nonce}"`。

**預期收益**：對博弈內容站特別重要 — XSS 防護更紮實。

---

### 🟡 P1-5：ReadingProgress 條件載入

`BaseLayout.astro` 第 147 行：`<ReadingProgress />` 全站載。實際只有 articles/ 下的頁面需要閱讀進度條。

**改法**：
```astro
{currentPage === 'articles' && <ReadingProgress />}
```

順便：DailyFortune 也許可以套同樣邏輯（首頁、文章頁有意義；games / casinos / tools 頁面意義不大）。

---

## 五、P2 進階優化（一個月內依 ROI 評估）

### 🟢 P2-1：Astro 4 → Astro 5 升級

Astro 5 已穩定，帶來：
- **Content Layer API**：`articles.js` 可改為 type-safe + Zod schema 驗證
- **Server Islands**：局部 SSR（例如「最新樂透開獎」可走 SSR、其他全 SSG）
- **Asset pipeline 改進**
- Dev startup ~35% 快、build 也快

升級 risk 中等。建議：
1. 開測試 branch、跑 `npx @astrojs/upgrade`
2. `astro check` 看有什麼破
3. 檢查 sitemap integration、image API、redirect 行為都正常
4. 部署 staging 環境跑一週

---

### 🟢 P2-2：加 ViewTransitions（SPA-like 切頁）

```astro
import { ViewTransitions } from 'astro:transitions';

<head>
  ...
  <ViewTransitions />
</head>
```

- 文章與文章間切換變平滑
- `<a prefetch>` 可預載下一頁
- 對「連續讀好幾篇攻略」的場景幫助大（典型博弈站使用者行為）

風險：CSS animation / setInterval 等可能需要重 init。建議在 BaseLayout 加 `<script>` 處理 `astro:after-swap` 事件。

---

### 🟢 P2-3：articles.js 改 Content Collections

44 篇文章 + array — 改用 Astro Content Collections（或 v5 的 Content Layer）：
- Zod schema 驗證（漏寫 thumbnail / date 編譯期就抓到）
- 自動 paginate / filter / sort
- type-safe `getCollection('articles')`

短期成本中等（要重新組織 frontmatter），長期維護輕很多。

---

### 🟢 P2-4：跑一次 Lighthouse 基準線

目前我看不到實際 LCP / CLS / TBT 數據。建議：

1. **PageSpeed Insights**（https://pagespeed.web.dev/）跑首頁 + 3-5 篇文章 + /lottery + /games/seth-2，記錄 mobile / desktop 兩組
2. **GSC「核心網頁指標」報表** 看真實使用者數據（CrUX）
3. **Cloudflare Web Analytics** 如果開了，看 RUM 數據

把基準線記下來、做完 P0/P1 後再跑一次比對 — 才知道哪些動作真的有效益。

---

### 🟢 P2-5：考慮加 AVIF 輸出

對應 P1-1 的 Astro Image — 改用之後同時輸出 AVIF。

現代瀏覽器支援度：
- Chrome 85+（2020-08）
- Safari 17+（2023-09）
- Firefox 113+（2023-05）
- Edge 121+

採用 `<picture>` + `<source type="image/avif">` + WebP fallback 即可。Astro `<Image>` 元件內建支援。

**預期收益**：圖片再省 25-30%。

---

## 六、建議執行順序

### Week 1（本週）
- [ ] P0-1 刪除舊 PNG（30 分鐘）
- [ ] P0-3 重壓 6 張肥 WebP（1-2 小時）
- [ ] P0-4 修 `gtag()` window bug（10 分鐘）
- [ ] **跑一次 PageSpeed 基準線**（15 分鐘）

### Week 2-3
- [ ] P0-2 清理 20+ 文章的 `<style is:global>`（2-3 天工 — 最花時間但 ROI 高）
- [ ] P1-3 Newsletter script 改條件載入（30 分鐘）
- [ ] P1-5 ReadingProgress 條件載入（10 分鐘）

### Week 4
- [ ] P1-1 Astro Image 改寫（先動 hero / cover 圖）
- [ ] P1-2 DailyFortune 按需載入

### Month 2
- [ ] P1-4 CSP hash-based
- [ ] P2-1 Astro 5 升級評估
- [ ] P2-2 ViewTransitions
- [ ] P2-3 Content Collections 重構

---

## 七、附錄：關鍵數據

### 7.1 站台規模

| 指標 | 數字 |
|---|---|
| 總頁數（dist HTML） | 68 |
| 文章數（src/pages/articles/） | 44+ |
| 圖片總數（public/images/） | 552 |
| 其中 WebP | 542（98%） |
| 其中 PNG | 9（待清理） |
| 其中 JPG | 1 |
| dist 體積 | 44 MB |

### 7.2 Repo 活動

- **30 天 commits**：30+
- **最頻繁修改檔案**：`src/pages/index.astro`、`src/data/articles.js`、`src/components/DailyFortune.astro`、`src/styles/global.css`
- **最近大改**：DailyFortune 元件新增、tg-bot worker、weekly newsletter template

### 7.3 已部署 Workers

| Worker | 用途 |
|---|---|
| 主 Worker（`/api/lottery`） | 台彩 API proxy + cache |
| `lottery-cron` | 定時更新樂透資料？ |
| `tg-bot` | Telegram bot 整合 |
| `api/` | （需確認用途） |

### 7.4 Headers / Cache 策略（_headers 檔）

| 路徑 | Cache | 安全 Headers |
|---|---|---|
| `/*` | — | HSTS / X-Frame-Options / CSP / Permissions-Policy 全套 |
| `/images/*` | `max-age=31536000, immutable` | — |
| `/*.css` | `max-age=31536000, immutable` | — |
| `/*.js` | `max-age=31536000, immutable` | — |
| `/*.webp` | `max-age=31536000, immutable` | — |
| `/*.woff2` | `max-age=31536000, immutable` | — |

---

## 八、風險清單（已知 / 潛在）

| 風險 | 影響 | 緩解 |
|---|---|---|
| `gtag()` 未掛 window | 元件內事件追蹤失效 | P0-4 |
| `'unsafe-inline'` 在 CSP | XSS 防護被弱化 | P1-4 |
| 文章 inline CSS 衝突 | 改 global.css 不見得反映 | P0-2 |
| Astro 4 已非最新 | 之後升級成本累積 | P2-1 |
| 重元件全站載 | 首屏 JS 解析時間長 | P1-2、P1-5 |
| 圖片無 srcset | 手機載桌機尺寸圖、頻寬浪費 | P1-1 |

---

## 九、聯絡與後續

如需針對任一項目開工或進一步討論：

- **直接修檔**：列出想處理的項目編號（如 P0-1、P1-3），即可逐一執行
- **跑量測**：建議先跑 PageSpeed Insights 取得基準線再動工
- **Astro 5 升級**：建議先開測試 branch，不要直接動 main

報告結束。

