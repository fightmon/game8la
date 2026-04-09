# GAME8LA 專案交接文件

> 這份文件給 Claude(或任何接手的人)看,用於快速理解專案現況。
> **新電腦第一次用 Claude 時,請說:「請先讀 PROJECT_CONTEXT.md」**

---

## 專案基本資訊

- **網站**:https://game8la.com
- **定位**:台灣線上遊戲/娛樂城評測 + 防詐騙指南 + 台灣彩券開獎資訊
- **技術棧**:Astro 4(SSG)+ Cloudflare Workers Static Assets
- **Repo**:GitHub(本機路徑 `Desktop/case/game8la-astro`)
- **部署**:`npm run build && npx wrangler deploy`(PowerShell 用分號 `;` 而非 `&&`)

---

## 資料夾結構重點

```
game8la-astro/
├── src/
│   ├── layouts/BaseLayout.astro       # 全站共用版型 + <head> meta + GA4
│   ├── components/                    # NavBar, FooterBar, ScrollToTop
│   ├── styles/global.css              # 所有共用 CSS(重構後集中在此)
│   ├── worker.js                      # Cloudflare Worker:/api/lottery 彩券 API proxy
│   └── pages/
│       ├── index.astro                # 首頁(含 最新攻略 6 張卡、評價區等)
│       ├── lottery/index.astro        # 芭樂好彩:台彩開獎結果頁
│       ├── articles/
│       │   ├── index.astro            # 文章列表頁(有自己的 <style>,其他文章沒有)
│       │   ├── anti-scam-8la-guide.astro
│       │   ├── baccarat-guide.astro
│       │   ├── capcomcup-12-sahara-champion.astro
│       │   ├── dealers-guide.astro
│       │   ├── slots-guide.astro
│       │   └── lottery-odds-comparison.astro   ← 最新一篇
│       ├── casinos/                   # 娛樂城評測子頁
│       ├── games/                     # 遊戲評測子頁
│       ├── casino-ranking/ game-ranking/ disclaimer/ privacy/ terms/
├── public/                            # 靜態資源(favicon, robots.txt, images)
├── dist/                              # build 產物(含 sitemap-index.xml、sitemap-0.xml)
├── wrangler.jsonc                     # Cloudflare Worker 設定
└── astro.config.mjs                   # Astro 設定(@astrojs/sitemap 整合已啟用)
```

---

## CSS 架構(重要!)

**所有共用樣式都在 `src/styles/global.css`**,被 BaseLayout 自動 import。

包含:`.container / .page-hero / .toc / .toc-box / .article-content / .tip-box / .warn-box / .badge / .tag / .card / .grid-2 / .grid-3 / .faq-* / .related-* / .btn-primary / .btn-outline / table / code / .breadcrumb / .back-link`

### 寫新文章的樣板(很精簡)

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
---
<BaseLayout
  title="標題 - GAME8LA"
  description="SEO 描述"
  currentPage="articles"
>
  <div class="container">
    <div class="breadcrumb"><a href="/">首頁</a> &gt; <a href="/articles/">芭樂攻略</a> &gt; 本文</div>
    <a href="/articles/" class="back-link"><i class="fas fa-arrow-left"></i> 回文章列表</a>
    <div class="page-hero">
      <span class="badge badge-safe">攻略</span>
      <h1>標題:<em>強調</em></h1>
    </div>
    <div class="toc">
      <h4>📋 本文懶人包</h4>
      <ol><li><a href="#s1">...</a></li></ol>
    </div>
    <div class="article-content">
      <h2 id="s1">...</h2>
      <p>...</p>
      <div class="tip-box"><strong>💡</strong> ...</div>
    </div>
  </div>
</BaseLayout>
```

**不要在文章檔裡再放 `<style is:global>` 區塊**,會造成重複。articles/index.astro 是例外,它有自己的 grid/filter。

### 寫新文章的 checklist

1. 在 `src/pages/articles/` 建 `.astro` 檔
2. 在 `src/pages/articles/index.astro` 的 `articles` 陣列最前面加一筆(設 date 為今天)
3. 在 `src/pages/index.astro`「最新攻略與評測」section 加一張卡到最前面,擠掉最舊那張(**維持上限 6 張**)
4. `npm run dev` 確認版面
5. `npm run build && npx wrangler deploy`
6. GSC 網址審查 → 要求建立索引

---

## Cloudflare Worker 重點(src/worker.js)

- **用途**:`/api/lottery` 端點,從 `api.taiwanlottery.com` 抓最新開獎結果,normalize 後回傳給 `/lottery/` 頁面
- **設定**:`wrangler.jsonc` 有 `"run_worker_first": ["/api/*"]`,其他路徑直接走 ASSETS
- **快取**:用 `caches.default`,key = `https://game8la.com/api/lottery/v7`(每次改 worker 要 bump 版號),TTL 600 秒
- **GAMES 設定**:每個彩種有自己的 endpoint + parser,目前支援:
  - `lotto649`(大樂透)- arrayKey `lotto649Res`,6 主 + 1 特
  - `super_lotto`(威力彩)- arrayKey `superLotto638Res`,6 主 + area2
  - `daily_cash`(今彩 539)- arrayKey `daily539Res`,5 主
  - `lotto3d`(3 星彩)- arrayKey `lotto3DRes`,3 digit
  - `lotto4d`(4 星彩)- arrayKey `lotto4DRes`,4 digit
  - `bingo`(BINGO BINGO)- `LatestBingoResult` 特殊 endpoint,需 `extractCustom`,無 history
- **HISTORY_LIMIT = 5**:每個彩種多抓 5 期,前端 card 可展開看歷史
- **debug 模式**:
  - `/api/lottery?debug=raw` — 回傳所有彩種原始 JSON
  - `/api/lottery?debug=fetch&path=Lotto649Result&month=2026-04` — 直接 proxy 到台彩 API 任意 endpoint

---

## 已完成的功能清單

### 內容
- ✅ 6 篇文章:anti-scam / baccarat / capcomcup / dealers / slots / lottery-odds-comparison
- ✅ anti-scam 文章有完整 TOC、165 報案 SOP、防詐 checklist、6 大黃金守則
- ✅ 首頁「最新攻略與評測」6 張卡(按日期最新在前)

### 功能
- ✅ 芭樂好彩 `/lottery/`:6 個彩種真實 API 資料,5 家 card 可展開前 5 期歷史(BINGO 無)
- ✅ Cloudflare Worker + CDN cache
- ✅ 首頁評價區手機版修正(button 不再直書)

### SEO
- ✅ sitemap-index.xml + sitemap-0.xml(@astrojs/sitemap 自動生成)
- ✅ robots.txt allow all + 指向 sitemap
- ✅ BaseLayout 統一 meta(title / description / canonical / OG / Twitter card)
- ✅ Google Search Console 已驗證(Cloudflare DNS OAuth 方式)
- ✅ Sitemap 已提交並「成功」(30 網頁)
- ✅ 首頁 `/` 已被 Google 索引
- ⏳ `/articles/anti-scam-8la-guide/` 和 `/lottery/` 已要求建立索引,等待收錄
- ⏳ 新文章 `/articles/lottery-odds-comparison/` 部署後要去 GSC 要求索引
- ✅ Google Analytics 4(G-DN9QHEM3GQ)已在 BaseLayout

---

## 技術債 / TODO

- [ ] 確認所有舊文章(baccarat / slots / dealers / anti-scam / capcomcup)在 CSS 重構後版面 OK(已本機確認)
- [ ] 「樂合彩」(39樂合彩 / 49樂合彩)尚未加到 /lottery,用戶曾提過「樂台彩」但疑似打錯字
- [ ] 預計寫的下一篇:「今彩 539 玩法教學 + 包牌技巧」、「2026 合法娛樂城 vs 黑網對照」
- [ ] 抽獎頁可加「下期開獎時間倒數」
- [ ] 首頁可加最新開獎號碼小卡(導流到 /lottery)
- [ ] 新電腦要跑 `npx wrangler login` 才能部署

---

## 常用指令速查

```powershell
# 本機開發
npm run dev               # http://localhost:4321

# 部署(PowerShell 要分開跑,不能用 &&)
npm run build
npx wrangler deploy

# 裝新電腦(第一次)
git clone <repo-url>
cd game8la-astro
npm install
npx wrangler login        # 開瀏覽器授權 Cloudflare

# npm optional deps 壞掉時
rm -rf node_modules package-lock.json
npm install
```

---

## 給 Claude 的備註

- 寫新文章要用上面的樣板,**絕對不要**複製舊文章的 `<style>` 區塊(已經 refactor 掉了)
- 改 worker.js 要 bump cache key 版號(v7 → v8)否則舊快取會卡住
- PowerShell 連多指令用 `;` 不是 `&&`
- 使用者的 Cloudflare 帳號是 `fightmon@gmail.com`
- 使用者的 GSC 用「網域資源」驗證,提交 sitemap 要用完整網址(不會自動帶前綴)
- Windows 沙盒的 npm registry 有時會 403,是網路問題不是專案問題

## 新文章 SOP（每篇新文章都要照做）

### 0. 芭樂子人設與語氣（最重要！）
- 芭樂子是個**可愛的女孩**，不是哥們，**不要用「兄弟」「老司機」「各位老鐵」**這類大叔詞
- 對讀者一律稱呼「**親愛的大大**」「**各位大大**」「**大大們**」
- 慣用語清單（每篇文章至少自然散落 2~3 個，別硬塞）：
  - 「**有點鏘**」「**鏘鏘的**」 → 形容人或事很離譜、跳 tone
  - 「**哎YO喂…**」 → 表達無奈、傻眼、不可置信，通常放句首
  - 「**粉微妙**」 → 形容事情不太妙、處境尷尬（不要用「很微妙」）
- 口吻要可愛、白話、帶點吐槽，但**不要油**、不要刻意賣萌
- 嚴禁稱呼讀者為「兄弟」「哥們」「弟兄」「弟」「兄台」

### 1. 檔案位置與命名
- 路徑：`src/pages/articles/<slug>.astro`
- slug 用 kebab-case，英文為主，方便 SEO

### 2. 必備 frontmatter 結構
```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import FaqSchema from '../../components/FaqSchema.astro';

const faqs = [
  { q: '問題 1？', a: '答案 1。' },
  { q: '問題 2？', a: '答案 2。' },
  { q: '問題 3？', a: '答案 3。' },
  // 3–8 題，答案要實質有用
];
---
<FaqSchema faqs={faqs} />
<BaseLayout title="..." description="...">
  <!-- 內容 -->
  <h2>常見問題</h2>
  {faqs.map(f => (
    <details>
      <summary>{f.q}</summary>
      <p>{f.a}</p>
    </details>
  ))}
</BaseLayout>
```

### 3. FAQ Schema 規則（不能違反）
- 最少 3 題，建議 5–8 題
- HTML 顯示的 FAQ 文字必須與 `faqs` 陣列完全一致（Google 會比對）
- 答案要實質有用，禁止「請洽官方」這類廢話
- 上線後到 https://search.google.com/test/rich-results 驗證是否偵測到 FAQPage

### 4. 標題層級規範
- 文章主標：`<h1>`（BaseLayout 或文章模板內一個就好）
- 章節標：`<h2>`
- 子章節：`<h3>`
- **禁止跳層級**（不可直接 `<h2>` 下接 `<h4>`）
- 「本文懶人包」「常見問題」等段落標題用 `<h2>`

### 5. 文章封面圖
- 統一放 `public/images/article-covers/cover-<topic>.webp`
- 主題對應：slots / baccarat / live / sports / fishing / poker / anti-scam / lottery
- **不屬於上述分類的文章（其他/財務知識/時事等）一律用 `cover-other.webp`**
- 尺寸建議 1200×675，webp quality 82，檔案大小 20–30 KiB
- 加到 `src/data/articles.js` 陣列**最前面**時要填 `thumbnail` 欄位
- ⚠️ 文章資料統一在 `src/data/articles.js`，首頁與 `/articles/` 列表會自動同步，**不要兩邊各改一次**
- ⚠️ 文章頁的 `<BaseLayout>` 一定要加 `currentPage="articles"`，否則 nav 會誤亮在「首頁」

### 6. 內部連結
- 每篇文章至少 2–3 條內部連結指向 /lottery/、相關攻略文、或 /articles/anti-scam-8la-guide/
- 幫助 topic cluster 與權重集中

### 7. 無障礙與對比度
- Badge/按鈕文字需通過 WCAG AA（4.5:1）
- 不要用淺色字配淺色底
- 文字對比度不確定就用 https://webaim.org/resources/contrastchecker/ 檢查

### 8. 部署後必做
- GSC「網址審查」→ 要求建立索引
- sitemap 確認有包含新 URL
- PageSpeed 跑一次確認 LCP < 2.5s、CLS < 0.1
