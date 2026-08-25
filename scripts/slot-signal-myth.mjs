// 「爆分訊號」實測：用戰神呂布引擎跑大量旋轉，檢驗三個流傳最廣的說法。
// 用法：node scripts/slot-signal-myth.mjs [轉數]
import { createGame, mulberry32 } from '../public/lubu/engine.mjs';

const N = parseInt(process.argv[2], 10) || 3000000;
const BET = 20;
const VOL = process.argv[3] || 'mid';
const g = createGame({ rtp: 96, vol: VOL, rng: mulberry32(20260826) });

let dry = 0;                       // 目前連續沒中的次數
const dryLens = [];                // 每段乾旱的長度
const afterDry = {};               // 連續沒中 k 次之後，下一轉的中獎統計
const buckets = [0, 10, 20, 30, 50, 80];
for (const b of buckets) afterDry[b] = { n: 0, win: 0, sum: 0 };

let hits = 0, totalWin = 0, totalBet = 0, baseSpins = 0;
let fgSpins = 0;

for (let i = 0; i < N; i++) {
  // 只統計基礎遊戲（免費遊戲不用花錢、不該混進來）
  const bucket = buckets.filter((b) => dry >= b).pop();
  const r = g.spin(BET);
  totalBet += r.cost; totalWin += r.win;      // RTP 要算全部（免遊成本 0、獎金照計）
  if (r.wasFreeSpin) { fgSpins++; continue; } // 但連續空轉只看基礎遊戲
  const won = r.win > 0;
  if (won) hits++;

  baseSpins++;
  const s = afterDry[bucket];
  s.n++; if (won) { s.win++; s.sum += r.win / BET; }

  if (won) { if (dry > 0) dryLens.push(dry); dry = 0; } else dry++;
}

const pct = (a, b) => (b ? (a / b) * 100 : 0);
console.log(`# 「爆分訊號」實測 — 戰神呂布引擎，RTP 96%、${VOL === 'high' ? '高' : VOL === 'low' ? '低' : '中'}波動，共 ${N.toLocaleString()} 轉\n`);

console.log('【說法一】「連續空轉越久，下一轉越容易中」');
console.log('目前已連續沒中 N 次 → 下一轉的中獎率與平均贏分：');
for (const b of buckets) {
  const s = afterDry[b];
  if (s.n < 200) { console.log(`  已空轉 ≥${String(b).padStart(2)} 次：樣本僅 ${s.n} 筆，不足以判斷`); continue; }
  console.log(`  已空轉 ≥${String(b).padStart(2)} 次：中獎率 ${pct(s.win, s.n).toFixed(2)}%`
    + `　平均贏分 ${(s.sum / s.n).toFixed(3)}x　（樣本 ${s.n.toLocaleString()} 轉）`);
}
const base = afterDry[0], deep = afterDry[20];
console.log(`  → 差距：${Math.abs(pct(base.win, base.n) - pct(deep.win, deep.n)).toFixed(2)} 個百分點。`);
console.log('    機器沒有記憶，前面輸多久都不會改變下一轉。\n');

dryLens.sort((a, b) => a - b);
const q = (p) => dryLens[Math.floor(dryLens.length * p)];
console.log('【說法二】「連續沒中這麼多次，一定是快爆了」');
console.log(`  總共出現 ${dryLens.length.toLocaleString()} 段連續空轉`);
console.log(`  中位數 ${q(0.5)} 次、90% 分位 ${q(0.9)} 次、99% 分位 ${q(0.99)} 次、最長 ${dryLens[dryLens.length - 1]} 次`);
console.log(`  → 連續空轉 ${q(0.9)} 次以上其實每 10 段就會出現 1 次，是常態不是徵兆。\n`);

console.log('【說法三】「看得出這台今天鬆不鬆」');
const sessions = 200, spinsPer = 300;
const g2 = createGame({ rtp: 96, vol: VOL, rng: mulberry32(999) });
const rtps = [];
for (let s = 0; s < sessions; s++) {
  let b = 0, w = 0;
  for (let i = 0; i < spinsPer; i++) { const r = g2.spin(BET); b += r.cost; w += r.win; }  // 含免遊
  rtps.push((w / b) * 100);
}
rtps.sort((a, b) => a - b);
console.log(`  同一台機器、同樣設定 RTP 96%，切成 ${sessions} 段各 ${spinsPer} 轉：`);
console.log(`  單段實測 RTP 最低 ${rtps[0].toFixed(1)}%、中位 ${rtps[Math.floor(sessions / 2)].toFixed(1)}%、最高 ${rtps[sessions - 1].toFixed(1)}%`);
console.log(`  → 「今天這台很鬆／很緊」只是同一台機器的正常波動，不是機器狀態。\n`);

console.log(`（整體對照：${N.toLocaleString()} 轉實測 RTP ${pct(totalWin, totalBet).toFixed(2)}%、基礎遊戲中獎率 ${pct(hits, baseSpins).toFixed(2)}%）`);
