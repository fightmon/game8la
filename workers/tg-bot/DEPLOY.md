# Game8la TG Bot 部署指南

## 部署步驟

### 1. 進入 Worker 目錄
```bash
cd workers/tg-bot
```

### 2. 設定 Bot Token（Secret，不會進版控）
```bash
npx wrangler secret put TG_BOT_TOKEN
# 貼上 BotFather 給的 Token：8160198435:AAFFCQsea7W0...
```

### 3. 部署到 Cloudflare
```bash
npx wrangler deploy
```

### 4. 設定 Webhook（部署後瀏覽器開一次）
```
https://game8la-tg-bot.<你的子網域>.workers.dev/setup-webhook
```
看到 `{"ok":true}` 就成功了

### 5. 取得群組 Chat ID
在 TG 群組裡輸入 `/chatid`，Bot 會回覆群組 ID（通常是負數如 `-100xxxxxxxxxx`）

### 6. 填入 Chat ID
打開 `wrangler.toml`，把 `TG_CHAT_ID` 填入，然後重新部署：
```bash
npx wrangler deploy
```

---

## 功能說明

| 功能 | 觸發方式 | 說明 |
|------|----------|------|
| 歡迎新成員 | 自動 | 新人加入群組時自動歡迎 |
| 每日推薦彩號 | 每天 09:00 | Cron 自動發送 539 冷熱分析 |
| 關鍵字回覆 | 自動 | 偵測訊息關鍵字回覆連結 |
| 新文章推播 | API 呼叫 | POST /push-article |

## 推播新文章（手動或 CI）

```bash
curl -X POST https://game8la-tg-bot.xxx.workers.dev/push-article \
  -H "Authorization: Bearer 你的BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "文章標題",
    "url": "https://game8la.com/articles/xxx/",
    "desc": "一句話描述",
    "category": "slots"
  }'
```

category 可選：slots, lottery, scam, guide, tool, review

## Bot 指令

- `/help` — 說明
- `/ranking` — 遊戲排名
- `/tools` — 工具箱
- `/lottery` — 彩券分析
- `/scam` — 娛樂城體檢
- `/chatid` — 取得 Chat ID

## 關鍵字列表

輸入以下關鍵字，Bot 會自動回覆對應資源：

RTP、詐騙、戰神賽特、雷神、麻將、魔龍、糖果、呂布、包牌、539、樂透、威力彩、模擬、工具、現金版、信用版、違法、排名
