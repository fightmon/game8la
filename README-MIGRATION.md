# GAME8LA Astro 遷移指南

歡迎使用 GAME8LA Astro 靜態網站骨架！本檔案說明如何從原始 HTML 遷移到 Astro 框架。

## 專案結構

```
game8la-astro/
├── astro.config.mjs           # Astro 配置文件
├── src/
│   ├── layouts/               # Astro 佈局組件
│   │   ├── BaseLayout.astro  # 基礎佈局（導覽列、頁腳、SEO）
│   │   └── ArticleLayout.astro # 文章專用佈局
│   ├── components/            # 可重用組件
│   │   ├── NavBar.astro      # 導覽列
│   │   ├── FooterBar.astro   # 頁腳
│   │   ├── ScrollToTop.astro # 返回頂部按鈕
│   │   └── ShareButtons.astro # 社交分享按鈕
│   ├── pages/                 # 路由頁面
│   │   ├── index.astro       # 首頁
│   │   ├── games/
│   │   │   └── seth2.astro   # 遊戲詳細頁面範例
│   │   └── 404.astro         # 404 錯誤頁面
│   └── styles/
│       └── global.css         # 全域 CSS（變數、重置、動畫）
└── public/
    └── images/                # 圖片資源（需要手動複製）
```

## 文件遷移計畫

### 1. 首頁 (`src/pages/index.astro`)

目前是佔位符。遷移步驟：

1. 開啟原始檔案 `game-review-site.html`
2. 複製英雄橫幅部分（`.hero` 和相關樣式）
3. 建立新的 Astro 組件如 `src/components/HeroBanner.astro`
4. 複製遊戲排名部分到 `src/components/GameRanking.astro`
5. 複製熱門遊戲網格到 `src/components/GamesGrid.astro`
6. 複製文章部分到 `src/components/ArticleSection.astro`
7. 在 `src/pages/index.astro` 中組合這些組件

### 2. 遊戲詳細頁面 (`src/pages/games/[slug].astro`)

目前範例：`src/pages/games/seth2.astro`

遷移步驟：

1. 建立動態路由：`src/pages/games/[slug].astro`
2. 從 `game-detail-1.html`, `game-detail-2.html` 等提取內容
3. 使用 `ArticleLayout` 組件（已包含包含麵包屑、日期、社交分享）
4. 遊戲數據可存儲在 `src/data/games.json` 或 `src/content/games/` 中
5. 使用 Astro 的 `getStaticPaths()` 生成靜態頁面

### 3. 文章頁面

目前不存在於此骨架中。遷移步驟：

1. 建立 `src/pages/articles/[slug].astro` 動態路由
2. 從 `article-baccarat.html`, `article-dealers.html` 提取內容
3. 使用 `ArticleLayout` 組件
4. 建立 `src/data/articles.json` 存儲文章元數據

### 4. 排名頁面 (`game-ranking.html`)

1. 建立 `src/pages/rankings/index.astro`
2. 建立 `src/components/RankingTable.astro` 組件
3. 複製排名樣式和 JavaScript 邏輯

### 5. 其他頁面

- `privacy.html` → `src/pages/privacy.astro`
- `terms.html` → `src/pages/terms.astro`
- `disclaimer.html` → `src/pages/disclaimer.astro`

## 開始開發

### 安裝依賴

```bash
npm install
```

### 開發伺服器

```bash
npm run dev
```

開啟 http://localhost:3000

### 建構生產版本

```bash
npm run build
```

輸出到 `dist/` 資料夾

### 預覽生產構建

```bash
npm run preview
```

## 複製圖片資源

原始 HTML 使用位於 `images/` 資料夾中的圖片。

**步驟：**

1. 將整個 `images/` 資料夾從原始項目複製到 `public/images/`
2. 更新所有圖片路徑：
   - 舊：`src="images/index/..."`
   - 新：`src="/images/..."`

```bash
cp -r /path/to/original/images public/
```

## CSS 自定義屬性

所有設計令牌定義在 `src/styles/global.css` 中：

```css
:root {
  --bg-primary: #121212;
  --bg-secondary: #1a1a1a;
  --gold: #39FF14;
  --gold-light: #39FF14;
  --guava-pink: #FF10F0;
  --text-primary: #FFFFFF;
  /* ... 更多變數 */
}
```

### 在組件中使用

在 `<style>` 標籤中：

```astro
<style>
  .my-element {
    background: var(--bg-primary);
    color: var(--text-primary);
  }
</style>
```

## 添加新遊戲詳細頁面

### 方法 1：手動建立

1. 建立 `src/pages/games/game-name.astro`
2. 使用 `ArticleLayout` 組件
3. 添加內容

### 方法 2：使用動態路由（推薦）

1. 建立 `src/pages/games/[slug].astro`
2. 定義 `getStaticPaths()`：

```astro
---
export async function getStaticPaths() {
  const games = [
    { slug: 'seth2', name: '戰神賽特2' },
    { slug: 'thor', name: '雷神之錘' },
  ];

  return games.map(game => ({
    params: { slug: game.slug },
    props: { name: game.name }
  }));
}

const { slug } = Astro.params;
const { name } = Astro.props;
---
```

## SEO 最佳實踐

所有佈局已包含：

- ✅ Meta 標籤（標題、描述）
- ✅ Open Graph 標籤（社交媒體分享）
- ✅ Twitter Card 標籤
- ✅ Canonical URL
- ✅ Google Analytics 4

使用 `BaseLayout` 或 `ArticleLayout` 時傳遞正確的 props：

```astro
<BaseLayout
  title="頁面標題"
  description="頁面描述"
  ogImage="https://example.com/image.webp"
  ogUrl="https://example.com/page"
/>
```

## 常見任務

### 添加新導覽連結

編輯 `src/components/NavBar.astro`：

```astro
<a href="/new-page/">新頁面</a>
```

### 編輯頁腳連結

編輯 `src/components/FooterBar.astro`：

```astro
<a href="/new-link/">新連結</a>
```

### 修改全域樣式

編輯 `src/styles/global.css` 並修改 CSS 變數或添加新規則。

### 添加新組件

在 `src/components/` 中建立 `.astro` 檔案：

```astro
---
interface Props {
  title: string;
}

const { title } = Astro.props;
---

<div class="my-component">
  <h2>{title}</h2>
</div>

<style>
  .my-component {
    /* 樣式 */
  }
</style>
```

## 部署

### Netlify

1. 連接您的 Git 倉庫
2. 構建命令：`npm run build`
3. 發佈目錄：`dist`

### Vercel

1. 連接您的 Git 倉庫
2. 框架：選擇「Astro」
3. 自動偵測構建設定

## 故障排除

### 圖片無法加載

- 確保 `images/` 資料夾已複製到 `public/`
- 檢查路徑是否以 `/` 開頭（例如 `/images/logo.webp`）

### 組件未顯示

- 檢查組件是否正確導入：`import NavBar from '../components/NavBar.astro'`
- 確認組件語法正確（`---` 分隔符、props 定義）

### 樣式未應用

- 全域樣式應在 `BaseLayout` 中導入
- 組件樣式應在 `<style>` 標籤中定義
- 使用 `is:global` 修飾符進行全域樣式

## 資源

- [Astro 官方文件](https://docs.astro.build)
- [Astro 組件文件](https://docs.astro.build/en/basics/astro-components/)
- [Astro CSS & 樣式](https://docs.astro.build/en/guides/styling/)

## 支援

如有問題，請聯絡：game8lala@gmail.com

祝遷移順利！🚀
