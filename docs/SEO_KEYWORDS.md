# GAME8LA 關鍵字攻略清單

> 這份文件記錄大毛指定要攻佔的目標關鍵字，以及每個關鍵字的執行狀態。
> 每次要寫新文章前，請先讀這份清單對照站上現況，提醒大毛哪些還沒補。
> 最後更新：2026-04-10

---

## 🎯 主目標關鍵字（大毛 2026-04-10 指定）

| # | 關鍵字 | 類型 | 優先級 | 狀態 | 對應頁面 |
|---|---|---|---|---|---|
| 1 | 老虎機 | 產品母詞 | 🔴 P0 | ✅ **已做 pillar** | [/articles/slots-guide/](https://game8la.com/articles/slots-guide/) — 老虎機完整指南（2026-04-10 重寫） |
| 2 | 娛樂城 | 產業母詞 | 🔴 P0 | ✅ **已做 pillar** | [/articles/online-casino-guide/](https://game8la.com/articles/online-casino-guide/) — 線上娛樂城完整指南（2026-04-10） |
| 3 | 真人娛樂 | 產品類目 | 🟡 P1 | ⚠️ 部分覆蓋 | 已有 [baccarat-guide](https://game8la.com/articles/baccarat-guide/)、[dealers-guide](https://game8la.com/articles/dealers-guide/)，缺 `/live-casino/` hub |
| 4 | 真人視訊 | 真人娛樂同義 | 🟡 P1 | ⚠️ 部分覆蓋 | 可併入 `/live-casino/` hub，目前只有子題文章 |
| 5 | 體育投注 | 產品類目 | 🟡 P1 | ❌ 未做 | 有 [capcomcup-12 esports](https://game8la.com/articles/capcomcup-12-sahara-champion/) 但算邊緣，需要 `/sports/` hub + 體育投注教學文 |
| 6 | 棋牌遊戲 | 產品類目 | 🟡 P2 | ❌ 未做 | 需要 `/card-games/` hub（可跟麻將胡了 slot 互相內鏈） |
| 7 | 彩票投注 | 產品類目 | 🟢 P2 | ⚠️ 部分覆蓋 | 已有 [539 包牌](https://game8la.com/articles/daily-cash-539-wheel-guide/)、[大樂透 vs 威力彩](https://game8la.com/articles/lottery-odds-comparison/)，缺 `/lottery/` hub |
| 8 | 遊藝場 | 傳統詞 | 🟢 P3 | ❌ 未做 | 單篇「遊藝場 vs 線上娛樂城」比較文 |

---

## 📚 非 slot 內容缺口

### 🛡️ 新手避坑類
- [x] 防詐騙 8LA 指南（/articles/anti-scam-8la-guide/）
- [ ] 第一次玩娛樂城 10 個新手必知
- [ ] 娛樂城出金卡關原因 Top 5 與解法
- [ ] 娛樂城代儲是什麼？為什麼不要用？

### 💰 金流 / 稅務類
- [x] 娛樂城中獎稅務指南（/articles/casino-jackpot-tax-guide/）
- [ ] 虛擬貨幣儲值 vs 銀行轉帳比較
- [ ] 大額中獎提領流程

### 🎲 產業知識類
- [x] 老虎機 RTP/波動性/術語對照（/articles/slots-guide/ 已涵蓋）
- [ ] RTP 是什麼？獨立一篇科普文（可從 slots-guide 拉出來加強）
- [ ] KYC 驗證流程
- [ ] 真人百家樂 vs 電子百家樂
- [ ] VIP 等級制度拆解

### ⚖️ 法規 / 合法性
- [ ] 台灣玩線上娛樂城合法嗎？
- [ ] 娛樂城法律風險說明

---

## 📖 現有文章盤點（2026-04-10 掃描）

| 文章 | 分類 | 服務關鍵字 |
|---|---|---|
| slots-guide | 老虎機 pillar | ✅ 老虎機 |
| atg-seth-1-vs-2-comparison | 老虎機比較 | 老虎機（子題） |
| atg-seth-guide | 老虎機教學 | 老虎機（子題） |
| baccarat-guide | 百家樂教學 | 真人娛樂、真人視訊 |
| dealers-guide | 荷官評比 | 真人娛樂、真人視訊 |
| daily-cash-539-wheel-guide | 彩券教學 | 彩票投注 |
| lottery-odds-comparison | 彩券比較 | 彩票投注 |
| capcomcup-12-sahara-champion | 電競新聞 | 體育投注（邊緣） |
| casino-jackpot-tax-guide | 稅務 | （通用知識）|
| anti-scam-8la-guide | 防詐 | （通用知識）|

---

## 🧭 建議下一步執行順序

1. ✅ **老虎機 pillar** — 已完成 2026-04-10
2. ✅ **娛樂城 pillar** — 已完成 2026-04-10
3. **真人娛樂 hub `/live-casino/`**（P1，2h）→ 整合 baccarat-guide + dealers-guide，補一篇真人娛樂入門
4. **彩票投注 hub `/lottery/`**（P2，1h）→ 整合 539 + 樂透比較，補一篇彩票投注入門
5. **體育投注 hub + 教學文**（P1，1 天）
6. **棋牌遊戲 hub**（P2，半天）
7. **遊藝場比較文**（P3，1~2h）

---

## 📋 使用說明（給 Claude）

每當大毛提出要寫新文章、或問「今天作什麼」時：

1. **先讀這份清單**（`docs/SEO_KEYWORDS.md`）
2. **掃一次 `src/pages/articles/`、`src/pages/games/` 跟 `src/data/articles.js`** 看哪些已經做了
3. **更新上方表格的狀態欄**（未做 → 進行中 → 已完成 + 連結）
4. **根據優先級提醒大毛**「還有哪幾個 P0/P1 沒做」
5. **完成任何一篇後**把對應項目打勾 + commit 更新這份文件

這樣能確保內容策略不會被忘記、優先級不會亂跑。
