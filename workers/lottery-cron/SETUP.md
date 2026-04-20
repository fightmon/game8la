# 芭樂好彩 — 彩券 Cron Worker 部署指南

> 自動每天 21:35 (UTC+8) 抓取台灣彩券開獎號碼，寫入 KV，觸發 Pages 重新部署。

---

## 架構總覽

```
每天 21:35 UTC+8
     │
     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Cron Worker │────▶│ 台彩官網抓取  │────▶│ Cloudflare   │
│  (scheduled) │     │ HTML → Parse  │     │ KV 儲存 JSON │
└──────┬───────┘     └──────────────┘     └──────────────┘
       │
       │ 有新資料時
       ▼
┌──────────────┐     ┌──────────────┐
│ Deploy Hook  │────▶│ Pages 重新   │
│ 或 CF API    │     │ 部署 (build) │
└──────────────┘     └──────────────┘
```

**資料流兩條路：**
1. **主線（靜態）**：Worker 更新 KV → 觸發 Pages rebuild → Astro build 時從 KV 讀 JSON → 產出靜態 `/data/xxx.json`
2. **備線（動態）**：前端直接 `fetch` Worker 的 `/data/xxx.json` endpoint（KV 直讀，不需等 rebuild）

目前先用 **備線** 即可運作，未來想要純靜態再切回主線。

---

## 步驟 1：安裝 Wrangler CLI

```bash
npm install -g wrangler

# 登入你的 Cloudflare 帳號
wrangler login
```

成功後會開瀏覽器授權，終端會顯示 `Successfully logged in`。

---

## 步驟 2：建立 KV Namespace

```bash
cd workers/lottery-cron

# 建立正式環境的 KV
wrangler kv:namespace create "LOTTERY_KV"
```

執行後會輸出一行像這樣：

```
{ binding = "LOTTERY_KV", id = "abc123def456..." }
```

**把那個 `id` 複製起來**，打開 `wrangler.toml`，把 `YOUR_KV_NAMESPACE_ID` 換掉：

```toml
[[kv_namespaces]]
binding = "LOTTERY_KV"
id = "abc123def456..."   # ← 貼上你拿到的 ID
```

---

## 步驟 3：上傳種子資料到 KV

第一次部署前，把現有的 JSON 種子資料上傳到 KV，這樣 Worker 才有歷史資料可以 append：

```bash
# 回到專案根目錄
cd ../../

# 上傳三個 JSON
wrangler kv:key put --namespace-id YOUR_KV_ID "json:daily-cash-539.json" --path public/data/daily-cash-539.json
wrangler kv:key put --namespace-id YOUR_KV_ID "json:super-lotto.json" --path public/data/super-lotto.json
wrangler kv:key put --namespace-id YOUR_KV_ID "json:lotto649.json" --path public/data/lotto649.json
```

（把 `YOUR_KV_ID` 換成步驟 2 拿到的 ID）

---

## 步驟 4：設定機密環境變數

這些不能寫在 `wrangler.toml` 裡（會被 commit），要用 `wrangler secret` 設定：

```bash
cd workers/lottery-cron

# 手動觸發用的密鑰（你自己想一個隨機字串）
wrangler secret put CRON_SECRET
# 輸入你想要的密鑰，例如：my-super-secret-key-2026

# Cloudflare Account ID（在 dashboard 右側欄可以找到）
wrangler secret put CF_ACCOUNT_ID
# 輸入你的 Account ID

# Cloudflare API Token
# 去 https://dash.cloudflare.com/profile/api-tokens 建一個新 token
# 權限：Account > Cloudflare Pages > Edit
wrangler secret put CF_API_TOKEN
# 輸入你的 API Token
```

### 更簡單的方法：用 Deploy Hook

去 Cloudflare Dashboard → Pages → game8la-astro → Settings → Builds & Deployments → Deploy Hooks

1. 點 "Add deploy hook"
2. 名稱填 `lottery-cron`
3. Branch 選 `main`
4. 複製產生的 URL

然後：
```bash
wrangler secret put CF_DEPLOY_HOOK_URL
# 貼上 deploy hook URL
```

用 Deploy Hook 的話，就不需要 `CF_API_TOKEN` 和 `CF_ACCOUNT_ID` 了（更簡單）。

---

## 步驟 5：部署 Worker

```bash
cd workers/lottery-cron
npm install
npm run deploy
```

成功後會顯示 Worker URL，例如：`https://lottery-cron.your-subdomain.workers.dev`

---

## 步驟 6：測試

### 手動觸發測試
```bash
curl "https://lottery-cron.your-subdomain.workers.dev/run?key=你的CRON_SECRET"
```

### 看即時 log
```bash
wrangler tail
```

開另一個終端手動觸發，就能看到執行過程的 console.log。

### 直接讀 KV 資料
```
https://lottery-cron.your-subdomain.workers.dev/data/daily-cash-539.json
```

---

## 步驟 7：更新前端讀取來源（可選）

如果你想讓冷數據專區直接讀 Worker 的即時資料（不等 Pages rebuild），改 `analysis/index.astro` 裡的 fetch URL：

```javascript
// 原本（靜態）
const resp = await fetch('/data/daily-cash-539.json');

// 改成（即時，從 Worker KV 讀）
const WORKER_URL = 'https://lottery-cron.your-subdomain.workers.dev';
const resp = await fetch(`${WORKER_URL}/data/daily-cash-539.json`);
```

也可以兩個都用（Worker 掛了就 fallback 到靜態）：
```javascript
async function fetchData(file) {
  try {
    const r = await fetch(`${WORKER_URL}/data/${file}`);
    if (r.ok) return r.json();
  } catch {}
  // fallback 到靜態
  return fetch(`/data/${file}`).then(r => r.json());
}
```

---

## Cron 排程說明

`wrangler.toml` 裡設定的是 UTC 時間：

| 設定 | 含義 |
|------|------|
| `35 13 * * *` | 每天 UTC 13:35 = 台灣 21:35 |

539 每天開獎所以每天都跑，Worker 內部會判斷威力彩和大樂透只在開獎日執行。

如果想改時間：
```toml
# 改成 22:00 台灣時間
crons = ["0 14 * * *"]

# 改成每 30 分鐘跑一次（測試用）
crons = ["*/30 * * * *"]
```

---

## 注意事項

1. **台彩官網可能改版**：HTML 結構變了就要更新 `fetchFromTWLottery()` 裡的正則式。部署後跑 `wrangler tail` 看 log 就知道有沒有抓到。

2. **KV 免費額度**：Cloudflare Workers Free plan 每天 1000 次 KV 讀寫，cron 一天只跑一次，完全夠用。

3. **Workers Free plan 限制**：每天 100,000 次請求、10ms CPU time。Cron 觸發不算在請求數裡。

4. **如果台彩官網擋爬蟲**：可以改用其他資料源，例如 data.gov.tw 開放資料，或自己建一個 Google Sheet 手動輸入。

---

## 所有指令總整理

```bash
# 1. 安裝
npm install -g wrangler && wrangler login

# 2. 建 KV
cd workers/lottery-cron
wrangler kv:namespace create "LOTTERY_KV"
# → 把 id 填回 wrangler.toml

# 3. 上傳種子資料
cd ../../
wrangler kv:key put --namespace-id <KV_ID> "json:daily-cash-539.json" --path public/data/daily-cash-539.json
wrangler kv:key put --namespace-id <KV_ID> "json:super-lotto.json" --path public/data/super-lotto.json
wrangler kv:key put --namespace-id <KV_ID> "json:lotto649.json" --path public/data/lotto649.json

# 4. 設定 secrets
cd workers/lottery-cron
wrangler secret put CRON_SECRET
wrangler secret put CF_DEPLOY_HOOK_URL   # 推薦用 Deploy Hook（最簡單）

# 5. 部署
npm install && npm run deploy

# 6. 測試
curl "https://lottery-cron.xxx.workers.dev/run?key=YOUR_SECRET"
wrangler tail   # 即時 log
```
