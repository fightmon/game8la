# `/tools/bless-blocks/` 線上擲筊 — 程式碼審查報告

> **稽核日期**：2026-05-10
> **稽核檔案**：`src/pages/tools/bless-blocks.astro`（1499 行）
> **稽核人**：Claude（Anthropic）
> **目的**：盤點現況、列出待修項目、給出優先序與具體修法

---

## 一、執行摘要 TL;DR

這個單元做得**相當細**：3D 翻轉動畫、Web Audio 木撞音、震動、20 連聖筊彩蛋、localStorage 持久化、5 平台分享、FAQ + WebApplication Schema、芭樂子文案 6 題 × 3 結果 × 3 變化共 54 條客製回覆 + 通用備案 + 連勝梯子。整體完成度高。

**但有 3 個 P0 問題需要立即處理**（合規 / 誠信 / a11y），加上 5 個 P1 體驗完整度問題。

P0 全部修完約 30 分鐘工，但不修白白扛 GSC 違規風險、使用者被細心抓出來砲、a11y WCAG 不過關。

---

## 二、已完成得好的部分（值得肯定）

| 項目 | 狀態 |
|---|---|
| 3D 翻轉動畫（2.5s 一段式，含下蹲 → 上拋 → 頂點懸停 → 落地 bounce） | ✅ |
| 兩筊不同時序（2.5s / 2.65s）製造自然感 | ✅ |
| 落地光暈動畫 | ✅ |
| Web Audio API 生成木撞聲（不需音檔資源） | ✅ |
| `navigator.vibrate(40)` 手機觸覺回饋 | ✅ |
| 6 題 × 3 結果 × 3 變化 = 54 條客製芭樂子吐槽 | ✅ |
| 連勝彩蛋 3-20+ 梯級遞進、機率動態計算 | ✅ |
| localStorage 每日持久化、隔日自動清舊 | ✅ |
| 5 平台分享（FB / X / Threads / IG / 複製連結） | ✅ |
| 分享 toast 提示 | ✅ |
| FAQ + WebApplication Schema | ✅ |
| 擲筊文化 SEO 靜態介紹文字 | ✅ |
| 手機版 RWD 完整 | ✅ |
| 收合式今日紀錄卡片（含 stats + log） | ✅ |
| 等高切換結果區（避免擲筊前後跳動） | ✅ |
| `escapeHtml()` 防 XSS | ✅ |

---

## 三、P0 立即修正（必修）

### 🔴 P0-1：`aggregateRating` 假數據違反 Google 結構化資料規範

**位置**：第 192 行

```js
"aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "89" }
```

**問題**：Google [Rich Results Guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) 明文規定 `AggregateRating` **必須是真實使用者評分**。塞假數據會被 GSC 標記違規，嚴重時下 manual action、整站從搜尋結果摘除部分功能。

**修法**：整段移除。

```diff
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "TWD" },
- "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "89" },
  "description": "免費線上擲筊模擬器..."
```

之後如果做評分系統收到真實數據，再加回來。

---

### 🔴 P0-2：FAQ / intro 寫「CSPRNG」但實際用 `Math.random()`

**位置**：
- 第 1198-1199 行用 `Math.random()`
- 第 206 行 FAQ schema 寫「使用密碼學等級的隨機數產生器（CSPRNG）」
- 第 165 行 intro 文字也寫「使用密碼學等級的隨機數產生器（CSPRNG）」

**問題**：
1. 技術上不對：`Math.random()` 是 PRNG，**不是** CSPRNG
2. 誠信問題：對外宣稱 CSPRNG 但實作不是、會被細心使用者抓出來砲

**修法 A（推薦，5 行改動）**：改用真的 CSPRNG。

```js
function getResult() {
  // 用瀏覽器內建 CSPRNG (crypto.getRandomValues) 取得真隨機
  var arr = new Uint8Array(2);
  crypto.getRandomValues(arr);
  var b1 = arr[0] & 1; // 0=yang, 1=yin
  var b2 = arr[1] & 1;
  if (b1 !== b2) return { type: 0, b1: b1, b2: b2 }; // 聖筊
  if (b1 === 0) return { type: 1, b1: 0, b2: 0 };    // 笑筊（兩陽）
  return { type: 2, b1: 1, b2: 1 };                    // 陰筊（兩陰）
}
```

**修法 B**：保留 `Math.random()`，改 FAQ + intro 文字，刪掉「CSPRNG」字眼。

**建議用 A**：這頁本來就強調「結果公正」，技術上做對才對得起文案。

---

### 🔴 P0-3：沒處理 `prefers-reduced-motion`（WCAG a11y 問題）

**問題**：2.5 秒大幅 3D 旋轉（rotateX 600°+）對前庭敏感的使用者會引發暈眩。**WCAG 2.1 SC 2.3.3** 要求重要動畫須尊重使用者偏好。

**修法**：在 `<style>` 段加：

```css
@media (prefers-reduced-motion: reduce) {
  /* 把 2.5s 大動畫縮成 0.4s 簡單翻轉，跳過頂點懸停 */
  .bless-block.throwing .block-inner,
  .bless-block.throwing-alt .block-inner {
    animation: blockThrowReduced 0.4s linear forwards;
  }
  @keyframes blockThrowReduced {
    0%   { transform: translateY(0) rotateX(0deg); }
    100% { transform: translateY(0) rotateX(var(--final-x)) rotateY(var(--final-y)); }
  }
  /* 落地光暈也關掉 */
  .bless-block.landed::after {
    animation: none;
    opacity: 0;
  }
  /* 連勝光圈呼吸也關 */
  .bless-streak {
    animation: none;
  }
}
```

順便修第 7 項建議的 `aria-live`：

```diff
- <div class="bless-result-header" id="resultHeader">
+ <div class="bless-result-header" id="resultHeader" aria-live="polite" aria-atomic="true">
```

---

## 四、P1 該補（UX / 民俗完整度）

### 🟡 P1-4：缺「連擲三次」按鈕（民俗核心儀式）

**問題**：擲筊文化的精髓就是「**三聖筊**」— 一次聖筊只算神明點頭、要三連聖筊才算強烈同意。目前要使用者手動點三次、每次中間還有 2.5 秒動畫 + 結果頁 + 手動再擲，體驗很斷。**這是這個工具最大的功能缺口**。

**修法建議**：在主擲筊按鈕旁加個次按鈕「🙏 連擲三次」，按下去自動連跑 3 次、最後顯示綜合結果（例如「3 次中 2 聖筊」+ 是否達成三聖筊）。

```html
<div class="bless-throw-row">
  <button class="bless-throw-btn" id="throwBtn">擲筊</button>
  <button class="bless-throw-btn-secondary" id="throwTripleBtn">🙏 連擲三次</button>
</div>
```

JS 邏輯：
```js
async function doTripleThrow() {
  if (isThrowing) return;
  var results = [];
  for (var i = 0; i < 3; i++) {
    await new Promise(function(resolve) {
      doThrow();
      setTimeout(function() {
        results.push(/* current result */);
        resolve();
      }, 3200); // 留足夠時間給單次動畫 + 結果顯示
    });
  }
  showTripleResult(results); // 顯示「3 中 X 聖筊」+ 達成感
}
```

---

### 🟡 P1-5：6 個問題藏在 dropdown，客製文案露出率低

**問題**：`select` 預設值是 `heart`（心中默念），使用者要點開才看到其他 6 個選項。寫了 **324 句** 精心調整的 reply（54 主題 reply × 6 題） 卻被埋住、大多數使用者只觸發 `GENERIC_REPLIES`。

**修法**：把 6 題改成水平 chip buttons、「心中默念」變尾巴 secondary。

```html
<div class="bless-question-chips">
  <button class="q-chip" data-q="0">今天運勢如何？</button>
  <button class="q-chip" data-q="1">這個決定對嗎？</button>
  <button class="q-chip" data-q="2">今天會有好事嗎？</button>
  <button class="q-chip" data-q="3">我該改變方向嗎？</button>
  <button class="q-chip" data-q="4">今天適合買彩券嗎？</button>
  <button class="q-chip" data-q="5">今天手氣好不好？</button>
  <button class="q-chip q-chip-custom active" data-q="heart">😌 心中默念</button>
</div>
```

CSS：
```css
.bless-question-chips {
  display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
  max-width: 600px; margin: 1.5rem auto;
}
.q-chip {
  background: rgba(255,255,255,0.05);
  border: 1px solid #333; border-radius: 20px;
  color: #ccc; padding: 8px 16px; cursor: pointer;
  font-size: 0.95rem; transition: all 0.2s;
}
.q-chip:hover { border-color: var(--guava-green); color: #fff; }
.q-chip.active {
  background: rgba(57,255,20,0.15);
  border-color: var(--guava-green);
  color: var(--guava-green);
}
```

點下去 active 反白、把舊 `select` 隱藏（or 移除）。使用者一眼看到 6 個選項、客製 reply 觸發率會提高很多。

---

### 🟡 P1-6：無「重置今日紀錄」按鈕

**問題**：`localStorage` 一寫進去使用者沒辦法手動清。如果不小心擲了一堆測試的、或想重來，沒得救。

**修法**：history toggle 旁加 ↻ icon button「清除今日」。

```html
<span class="history-toggle-right">
  <button class="history-reset-btn" id="historyResetBtn"
          type="button" aria-label="清除今日紀錄" title="清除今日紀錄">↻</button>
  <span class="history-badge" id="historyBadge">0 次</span>
  <span class="history-chevron" id="historyChevron">▼</span>
</span>
```

JS：
```js
document.getElementById('historyResetBtn').addEventListener('click', function(e) {
  e.stopPropagation(); // 不要觸發 toggle 收合
  if (!confirm('確定要清除今日所有擲筊紀錄？')) return;
  localStorage.removeItem(STORAGE_KEY);
  throwCount = { sheng: 0, xiao: 0, yin: 0 };
  consecutiveSheng = 0;
  logs = [];
  updateStats();
  updateLog();
});
```

---

### 🟡 P1-7：結果區沒 `aria-live`（已併在 P0-3 修法中）

每次擲完，結果文字 swap 但 screen reader 不會自動朗讀。已在 P0-3 修法附帶處理。

---

### 🟡 P1-8：沒有聲音 on/off toggle

**問題**：`playBlockSound()` 每擲必響、無 opt-out。開放空間用會尷尬。

**修法**：擲筊按鈕旁加 🔊 / 🔇 toggle、state 存 localStorage（用一個獨立 key 跨日不清）。

```html
<button class="sound-toggle" id="soundToggle"
        type="button" aria-label="切換音效" title="切換音效">🔊</button>
```

```js
var SOUND_KEY = 'bless_sound_enabled';
var soundEnabled = localStorage.getItem(SOUND_KEY) !== 'off';
var soundToggleBtn = document.getElementById('soundToggle');
soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
soundToggleBtn.addEventListener('click', function() {
  soundEnabled = !soundEnabled;
  localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off');
  soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
});

// 在 playBlockSound 內
function playBlockSound() {
  if (!soundEnabled) return;
  // ... 既有邏輯
}
```

---

## 五、P2 微優化（餘力時做）

### 🟢 P2-9：兩個筊的 SVG 重複定義 `linearGradient`

**問題**：`woodYang1` / `woodYang2` 內容一模一樣、`woodYin1` / `woodYin2` 也一樣。可以共用一份 `<defs>`，省 ~600 bytes HTML。

**修法**：把 defs 抽到單獨 `<svg width="0" height="0">`：

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <linearGradient id="woodYang" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d43a2a"/>
      <stop offset="50%" stop-color="#b82318"/>
      <stop offset="100%" stop-color="#8c1a10"/>
    </linearGradient>
    <linearGradient id="woodYin" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8c1a10"/>
      <stop offset="50%" stop-color="#701510"/>
      <stop offset="100%" stop-color="#55100c"/>
    </linearGradient>
  </defs>
</svg>
```

4 個 `<path fill="url(#woodYang)">` / `<path fill="url(#woodYin)">` 共用。

---

### 🟢 P2-10：`loadFromStorage` 邏輯瑕疵

**位置**：第 1106-1107 行

```js
var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
if (data && data.throwCount) {
```

**問題**：`data.throwCount` 是個 `{sheng:0, xiao:0, yin:0}` object、**永遠 truthy**。沒擲過但 storage 還有空 record 也會進這個分支。

**修法**：檢查實際擲筊總數。

```diff
- if (data && data.throwCount) {
+ if (data && data.throwCount && (data.throwCount.sheng + data.throwCount.xiao + data.throwCount.yin) > 0) {
```

---

### 🟢 P2-11：`currentQ` / `isCustom` 沒持久化

**問題**：使用者選了「今天運勢」、擲完、重整頁面、`select` 回到「心中默念」。但 stats / logs 都還在 — **狀態不一致**。

**修法**：`saveToStorage` 也存 `currentQ` 跟 `isCustom`，`loadFromStorage` 還原並設 `select.value`。

```diff
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      throwCount: throwCount,
      consecutiveSheng: consecutiveSheng,
-     logs: logs
+     logs: logs,
+     currentQ: currentQ,
+     isCustom: isCustom
    }));
  } catch(e) {}
}

function loadFromStorage() {
  try {
    var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && data.throwCount && (data.throwCount.sheng + data.throwCount.xiao + data.throwCount.yin) > 0) {
      throwCount = data.throwCount;
      consecutiveSheng = data.consecutiveSheng || 0;
      logs = data.logs || [];
+     if (typeof data.currentQ !== 'undefined') {
+       currentQ = data.currentQ;
+       isCustom = data.isCustom;
+       questionSelect.value = isCustom ? 'heart' : String(currentQ);
+     }
      return true;
    }
  } catch(e) {}
  return false;
}
```

如果 P1-5 採用 chip buttons，這邊也要還原 chip 的 active state。

---

### 🟢 P2-12：缺 BreadcrumbList Schema

**問題**：首頁 → 工具 → 擲筊 的路徑沒有 schema、GSC 不會顯示麵包屑。

**修法**：在頁尾的 schema script 旁加：

```astro
<script type="application/ld+json" set:html={JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "首頁", "item": "https://game8la.com/" },
    { "@type": "ListItem", "position": 2, "name": "工具", "item": "https://game8la.com/tools/" },
    { "@type": "ListItem", "position": 3, "name": "線上擲筊" }
  ]
})} />
```

---

### 🟢 P2-13：動畫期間沒鎖 `againBtn`

**問題**：`throwBtn` 有 `disabled` 但 `againBtn` 沒有。雖然動畫期間 `resultFooter` 是 hidden，但**萬一 race condition**（CSS hidden 但 DOM 還在）使用者快速點到，會 reset state 而 throw 還在跑。

**修法**：在 `doThrow` 開頭加 `if(againBtn) againBtn.disabled = true;`，結束時 false。

---

## 六、建議執行順序

### 今天（30 分鐘可全部處理）
- [ ] **P0-1** 刪 `aggregateRating`（1 行）
- [ ] **P0-2** 改 `crypto.getRandomValues`（5 行）
- [ ] **P0-3** 加 `prefers-reduced-motion` + `aria-live`（10 行 CSS + 1 行 HTML）

### 本週
- [ ] **P1-4** 連擲三次按鈕（最值得做、民俗核心）
- [ ] **P1-5** 6 題改 chip buttons（讓 324 句客製 reply 露出）
- [ ] **P1-6** 清除今日紀錄按鈕
- [ ] **P1-8** 聲音 on/off toggle

### 下週
- [ ] **P2-9** SVG defs 共用
- [ ] **P2-10** `loadFromStorage` 邏輯修正
- [ ] **P2-11** `currentQ` / `isCustom` 持久化
- [ ] **P2-12** BreadcrumbList schema
- [ ] **P2-13** `againBtn` race condition 鎖

---

## 七、附錄：檔案統計

| 指標 | 數字 |
|---|---|
| 總行數 | 1499 |
| Frontmatter + HTML | ~250 行 |
| `<style>` 區塊 | ~620 行 |
| `<script>` 區塊 | ~620 行 |
| 預設問題數 | 6（heart 為自訂） |
| 客製 reply 總數 | 324（6 題 × 3 結果 × 3 變化 × 2 邊界） |
| Generic reply 數 | 9 |
| 連勝彩蛋層級 | 3-20+（20+ 用通用模板） |
| 分享平台 | 5（FB / X / Threads / IG / 複製連結） |

---

## 八、風險清單

| 風險 | 嚴重度 | 緩解 |
|---|---|---|
| `aggregateRating` 假數據 | 🔴 高（GSC manual action） | P0-1 |
| 「CSPRNG」對外宣稱不符實作 | 🟡 中（誠信問題） | P0-2 |
| 2.5s 動畫無 reduced-motion 選項 | 🟡 中（WCAG 違規） | P0-3 |
| 缺民俗核心「連擲三次」 | 🟡 中（功能完整度） | P1-4 |
| `loadFromStorage` truthy bug | 🟢 低（不會造成資料壞，但邏輯瑕疵） | P2-10 |
| `againBtn` race condition | 🟢 低（極少觸發） | P2-13 |

---

報告結束。如果要從這份報告挑工項回來討論細節、或要某段範例程式碼跑過、可以隨時開新議題。
