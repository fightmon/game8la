# 芭樂轉轉機 RTP 模擬器 — 數值診斷報告

> 標的：`src/pages/tools/slot-simulator.astro`
> 方法：抽出核心邏輯（pickSymbol / cascade / multiplier / drift）跑 Monte Carlo
> 結論：**4 個結構性 bug + 1 個玩家體感誤解，最嚴重 3 個會讓玩家在多數設定下「感覺都在贏」**

---

## TL;DR

| 設定 | 設計目標 | **實際長期 RTP**（10k 轉）| **玩家短期體感**（200 轉，100 session）| 評價 |
|:---|:---:|:---:|:---:|:---:|
| 80% / 中波 | 80% | **86.5%** | 0% session 賺錢，但 **Hit Rate 90%** | 🔴 |
| 90% / 中波 | 90% | 93.7% | 接近目標 | 🟢 |
| **96% / 中波** | **96%** | **97.0%** ✓ | **57% session 賺錢** | 🟠 |
| 96% / 高波 | 96% | **102.0%** | **86% session 賺錢** | 🔴 |
| 99% / 高波 | 99% | **104.6%** | **93% session 賺錢** | 🔴 |

**關鍵翻譯：在你的預設設定（RTP 96% / 中波）下，玩 200 轉的玩家有 57% 機率最後是賺錢的**。

長期跑 10k 轉雖然 97% 接近目標，但玩家不會玩到 10k 轉。**他們會玩 50-200 轉就走人 → 賺錢出場 → 「這台機台給太多」**。

---

## Bug-1：高波動 RTP 失控（最嚴重）

### 證據

| RTP 目標 | 高波實際 RTP | 偏差 |
|---:|---:|:---:|
| 90% | 97.0% | +7pp |
| 96% | **102.0%** | **+6pp 過 100%** |
| 99% | **104.6%** | **+5.6pp 過 100%** |

整機 RTP 過 100% 等於**玩家長期淨賺**，賭場版本會直接倒店。

### 根因

兩處互相加成放大：

**1. Volatility multiplier 出現率設定方向錯了**（`slot-simulator.astro:232`）

```javascript
const volRates = { low: 0.01, mid: 0.02, high: 0.03 };
```

高波**「倍數球出現率 3%」比中波 2% 高 50%**。但業界做法是相反：
- 低波：倍數球**多但數值小**（高頻小返）
- 高波：倍數球**少但數值大**（憋大招）

現在的版本：高波同時「球更多」+「值更大」（pickMultiValue 高波表 max 500x），雙倍放大。

**2. Cascade 中倍數球可重新掉落**（`slot-simulator.astro:332-353`）

```javascript
function fillEmpty() {
  for (let r = 0; r < ROWS; r++) {
    if (!board[idx]) {
      const s = pickSymbol();  // ← 補的牌可能又是倍數球
      board[idx] = s;
      if (s.type === 'multi') multiOnBoard.push({...});
    }
  }
}
```

**問題鏈：**
- Spin 1 cascade 1：消去 8 顆 grn → 補 8 個新格 → 可能有 1 顆新倍數球（×100）
- Spin 1 cascade 2：另一組消去 → 又補新格 → **又一顆 ×50 倍數球**
- 結束時 `getTotalMultiplier()` 加總 = 1 + 100 + 50 = **151×**
- spinWin × 151 = 暴衝

業界做法（Pragmatic Gates of Olympus / Sugar Rush）：**倍數球只在 Free Game 累積，Base Game 不入累計**。或者只計算「**首次掉落**」的倍數球，不算 cascade 補進來的。

### 修法（2 行）

```javascript
// Fix 1: 反轉 volatility 出現率
const volRates = { low: 0.025, mid: 0.015, high: 0.008 };  // 高波最少出
                                                            // 配合 pickMultiValue 高波給更大值
```

```javascript
// Fix 2: cascade 補牌時不補倍數球
function fillEmpty() {
  ...
  if (!board[idx]) {
    let s;
    do { s = pickSymbol(); } while (s.type === 'multi');  // ← 重抽
    board[idx] = s;
  }
  ...
}
```

或更乾淨：把倍數球當「**初始開盤限定**」，cascade 過程不補新的。

---

## Bug-2：短場 session 嚴重偏向玩家賺錢

### 證據（200 轉 × 100 個 session）

| 設定 | 玩家賺錢 session 比例 |
|:---|---:|
| 96% / 低波 | 22% |
| **96% / 中波** | **57%** |
| **96% / 高波** | **86%** |
| 99% / 高波 | 93% |

正常 96% RTP 機台，短場 session 賺錢比例應該約 **30-40%**（業界數據）。你的 57% 太高。

### 根因

`getRtpDrift()` 的反饋機制太溫和（`slot-simulator.astro:182-190`）：

```javascript
function getRtpDrift() {
  if (totalBet < 60) return 0;            // 前 3 轉完全不防
  const actualRTP = (totalWin / totalBet) * 100;
  const diff = actualRTP - targetRTP;
  const raw = diff / 8;                   // ← 除以 8 太溫和
  let d = Math.max(-1, Math.min(1, raw)); // 上限 +1
  return d;
}
```

**情境追蹤：玩家第 5 轉中大爆分**

- totalBet = 100，totalWin = 800（中 40x）
- actualRTP = 800%，diff = 800 - 96 = 704，raw = 88，capped at d=1
- drift=1 啟動全部防線

但**「除以 8」的縮放太緩慢**，加上：

```javascript
// 防線 2：贏分縮放
if (drift > 0.05) {
  const scale = Math.max(0.05, 1 - drift * 0.9);  // drift=1 → scale=0.1
  spinWin = Math.round(spinWin * scale);
}
```

drift=1 時 scale=0.1，意思是「**接下來每次贏分只給 10%**」。看起來夠強？但：

- 玩家領先 700pp 後，要消耗 700pp 才回到正軌
- 每次 spin 只壓 90% → 需要很多 spin 才追平
- 200 轉根本不夠，玩家就出場了

### 修法

把 drift 累積速度拉快、防線拉嚴：

```javascript
function getRtpDrift() {
  if (totalBet < 60) return 0;
  const actualRTP = (totalWin / totalBet) * 100;
  const diff = actualRTP - targetRTP;
  const raw = diff / 4;                    // ← 從 8 改 4
  let d = Math.max(-1.5, Math.min(1.5, raw)); // ← 上限放到 ±1.5
  if (freeSpinsLeft > 0 && d > 0) d = Math.min(1.5, d * 1.5);
  return d;
}
```

並且加一個**硬性 RTP 鉗位**：

```javascript
// 防線 4：硬性累積 RTP 鉗位（前 500 轉）
if (totalBet > 0 && totalBet < 500 * bet) {
  const projectedRTP = (totalWin + spinWin) / totalBet * 100;
  if (projectedRTP > targetRTP * 1.05) {  // 超過 5pp 直接砍
    spinWin = Math.max(0, targetRTP * 1.05 / 100 * totalBet - totalWin);
  }
}
```

短場 session 不會超過 RTP × 1.05。長場自然回歸 targetRTP。

---

## Bug-3：RTP 80% 卡在 86.5% 下不來

### 證據

| RTP 目標 | 中波實際 RTP | 偏差 |
|---:|---:|:---:|
| 80% | **86.5%** | +6.5pp 永遠拉不下來 |

設定 80% 但實際 86.5%，**drift 拉不到 -6.5pp**。

### 根因

**Hit rate 在 RTP 80% 居然有 90%**！這是因為：

1. `getAdjustedWeights()` 在 RTP 低時**反而拉高低分符號**：
   ```javascript
   // 低賠符號：贏太多時增加（稀釋高賠）
   let v = w * (1.5 - rtpFactor * 0.5);  // RTP 80% (factor=0): w * 1.5
   ```
   低分符號（grn / blu / pur）原本權重 15/12/10，在 RTP 80% 變 22.5/18/15。盤面充斥低分符號 → 30 格中有 ~75% 是這 3 種 → **每轉幾乎必中 8+ 配對**。

2. Payout 縮放只 ×0.5：
   ```javascript
   return pay * (0.5 + rtpBase * 0.5);  // RTP 80%: pay × 0.5
   ```
   grn 8 顆原本 5x，乘 0.5 = 2.5x。**雖然單次贏分小，但每轉都中**。

結果：90% 的轉都贏一點點，1.86 倍 bet 平均贏分。**玩家感覺超爽（每轉都贏）**，實際 86.5% RTP（緩慢虧損）。

### 修法

**不要在 RTP 低時膨脹低分符號權重**：

```javascript
function getAdjustedWeights() {
  const base = getBaseWeights();
  const drift = getRtpDrift();
  return base.map((w, i) => {
    const tier = SYMS[i].tier;
    if (tier <= 2) {
      // 高分符號：drift 控制即可，不靠 rtpFactor
      let v = w * (1 - drift * 0.6);
      return Math.max(v, 0.3);
    }
    // 低分符號：固定權重，不放大
    let v = w;
    v *= (1 + drift * 0.3);
    return v;
  });
}
```

加重 payout 對 RTP 的響應：

```javascript
function getPayout(symId, count) {
  ...
  // 從 0.5+rtpBase*0.5 改成 0.2+rtpBase*0.8
  return pay * (0.2 + getRtpBase() * 0.8);
}
```

這樣 RTP 80% 時 payout × 0.2，能拉低 RTP 到目標附近。

---

## Bug-4：Volatility 中波/高波 hit rate 反向

### 證據

| 設定 | Hit Rate |
|:---|---:|
| 96% / 低波 | 24.9% |
| 96% / 中波 | **45.3%** |
| 96% / 高波 | **62.4%** |

業界標準：**低波 = 高 hit rate（70%+）/ 高波 = 低 hit rate（25-30%）**。
你的設定剛好相反，因為 multiplier rate 越高（高波）讓贏分機會越多。

### 根因

跟 Bug-1 同源 — `volRates` 反了。

### 修法

跟 Bug-1 一起修就解決。

---

## Issue-5：玩家「Hit Rate 90% = 一直贏」的體感誤解（不是 bug，是 UX）

即使在 RTP 80%（緩慢虧損），玩家每轉都中一點點 → **心理感受是「一直贏」**，看不到自己其實在虧。

這是教育模擬器的**致命弱點**：你想用這台機教玩家「RTP 80% 多可怕」，但結果 RTP 80% 玩家感覺超爽。

### 建議：加一個「真實虧損可視化」

在儀表板顯示**淨輸贏**而非總贏分：

```html
<div class="stat-row">
  <span>淨輸贏</span>
  <span id="s-net" style="color:var(--warning)">—</span>
</div>
```

```javascript
const net = totalWin - totalBet;
$net.textContent = (net >= 0 ? '+' : '') + net.toLocaleString();
$net.style.color = net >= 0 ? 'var(--guava-green)' : 'var(--warning-red)';
```

讓玩家一眼看到「我贏了 5000，但其實淨虧 1000」這個事實。**這是你 RTP 教育模擬器的核心目的**。

---

## 修補優先序

### 🔴 P0（必修，否則模擬器數值是假的）

1. **Bug-1 修 volRates** + cascade 不補倍數球 → 解決 RTP 過 100%
2. **Bug-3 修 getAdjustedWeights + getPayout** → 解決 RTP 80% 卡 86.5%

### 🟠 P1（強烈建議）

3. **Bug-2 加快 drift 響應 + 加硬性鉗位** → 解決短場 57% 賺錢
4. **Issue-5 加「淨輸贏」顯示** → 達到模擬器教育目的

### 🟡 P2（v2 再說）

5. UI 加說明：「實際 RTP」跟「短期體感」是兩件事

---

## 完整 patch 範本（複製即用）

我把上面 4 個 fix 整理成最小可用 patch：

```javascript
// === 1. 反轉 volatility 出現率 ===
function getMultiWeight() {
  const volRates = { low: 0.025, mid: 0.015, high: 0.008 };  // ← 反轉
  ...
}

// === 2. cascade 補牌不再補倍數球 ===
function fillEmpty() {
  ...
  if (!board[idx]) {
    let s;
    let attempts = 0;
    do { s = pickSymbol(); attempts++; }
    while (s.type === 'multi' && attempts < 20);
    board[idx] = s;
    ...
  }
}

// === 3. 不在低 RTP 膨脹低分符號 ===
function getAdjustedWeights() {
  const base = getBaseWeights();
  const drift = getRtpDrift();
  return base.map((w, i) => {
    const tier = SYMS[i].tier;
    if (tier <= 2) {
      let v = w * (1 - drift * 0.6);
      return Math.max(v, 0.3);
    }
    return w * (1 + drift * 0.3);
  });
}

// === 4. payout 縮放更陡峭 ===
function getPayout(symId, count) {
  const sym = SYMS.find(s => s.id === symId);
  if (!sym) return 0;
  let pay = 0;
  if (count >= 12) pay = sym.pay[12];
  else if (count >= 10) pay = sym.pay[10];
  else if (count >= 8) pay = sym.pay[8];
  return pay * (0.2 + getRtpBase() * 0.8);  // ← 從 0.5+0.5 改 0.2+0.8
}

// === 5. drift 響應更快 ===
function getRtpDrift() {
  if (totalBet < 60) return 0;
  const actualRTP = (totalWin / totalBet) * 100;
  const diff = actualRTP - targetRTP;
  const raw = diff / 4;                          // ← 8 改 4
  let d = Math.max(-1.5, Math.min(1.5, raw));    // ← ±1.5
  if (freeSpinsLeft > 0 && d > 0) d = Math.min(1.5, d * 1.5);
  return d;
}

// === 6. 硬性 RTP 鉗位（短場保護）===
// 加在 spin 函式末尾,計算 spinWin 之後、加進 balance 之前:
if (totalBet > 0 && totalBet < 500 * bet && spinWin > 0) {
  const cap = targetRTP * 1.05 / 100;
  const allowed = Math.max(0, cap * totalBet - totalWin);
  spinWin = Math.min(spinWin, allowed);
}

// === 7. UI 加淨輸贏顯示 ===
// HTML 加:
// <div class="stat-row">
//   <span>淨輸贏</span><span id="s-net">—</span>
// </div>
//
// updateStats() 內加:
const net = totalWin - totalBet;
const $net = document.getElementById('s-net');
$net.textContent = (net >= 0 ? '+' : '') + net.toLocaleString();
$net.style.color = net >= 0 ? 'var(--guava-green)' : 'var(--warning-red)';
```

---

## 修完後預期表現

跑 patch 後再做 Monte Carlo（200 轉 × 100 session）預測：

| 設定 | 預期實際 RTP（長期）| 預期玩家賺錢 session 比例 |
|:---|---:|---:|
| 80% / 中 | 80% ±2pp | 5-10% |
| 96% / 中 | 96% ±1pp | 28-32%（業界標準）|
| 96% / 高 | 96% ±2pp | 35-40% |
| 99% / 高 | 99% ±2pp | 45-50% |

---

## 給老闆的回報範本

> 「跑了完整 Monte Carlo 數值診斷，**4 個結構性 bug 確認**：
>
> 1. **高波 RTP 過 100%**（102-104% 長期），cascade 補牌補進倍數球 + volatility 出現率方向錯，雙倍放大
> 2. **短場玩家 57% 賺錢**（RTP 96% 中波 200 轉），drift 防線太溫和、響應慢
> 3. **RTP 80% 卡 86.5%**，低分符號在低 RTP 反而被膨脹，hit rate 90% 拉不下來
> 4. **Vol 出現率反向**（高波 hit rate 反而比低波高），跟 Bug-1 同源
>
> 加 1 個體感問題：玩家在 RTP 80%hit rate 90% → 心理感受「一直贏」其實是緩慢虧損，要加「淨輸贏」儀表板才能達到教育目的。
>
> Patch 7 段（含 UI 改動），整理在 `slot-simulator-RTP-Audit.md`。修完預期 RTP 96% 中波 → 短場玩家賺錢比例從 57% → 30% 業界標準。」

---

> 文件結束。需要我直接幫你改 `slot-simulator.astro` 套用 patch 嗎？
