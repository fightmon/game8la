// 驗證「購買免遊」（100 倍總押注直接進 15 場免遊）的 RTP 是否合理
// 用法：node scripts/lubu-buy-test.mjs [次數]
import { createGame, mulberry32, VOL, BUY_COST_X, BUY_RTP_RATIO } from '../public/lubu/engine.mjs';
const N = parseInt(process.argv[2],10) || 20000, BET = 20;
console.log(`# 購買免遊 RTP 驗證（每組 ${N.toLocaleString()} 次購買，售價 ${BUY_COST_X}x）\n`);
let fail = 0;
for (const vol of ['low','mid','high']) {
  for (const rtp of [92, 96, 99]) {
    const g = createGame({ rtp, vol, rng: mulberry32(777 + rtp) });
    let bet = 0, win = 0, best = 0, spinsInFg = [];
    for (let i = 0; i < N; i++) {
      let r = g.spin(BET, { buy: true });        // 這一轉＝免遊第 1 場
      bet += r.cost; let w = r.win, n = 1;
      while (r.fgLeft > 0) { r = g.spin(BET); w += r.win; n++; }   // 跑完整輪免遊
      win += w; spinsInFg.push(n);
      if (w / BET > best) best = w / BET;
    }
    const R = win / bet * 100;
    const avgSpins = spinsInFg.reduce((a,b)=>a+b,0) / spinsInFg.length;
    // 對照「已記錄的折損率」而非設定 RTP——低波動買免遊本來就吃虧，這是特性不是 bug。
    // 這道測試是回歸防線：折損率若偏離記錄值，代表引擎被改動且 UI 上的揭露數字已過期。
    const expect = rtp * BUY_RTP_RATIO[vol];
    const ok = Math.abs(R - expect) < 5;
    if (!ok) fail++;
    console.log(`${ok?'✅':'❌'} ${VOL[vol].name} 目標 ${rtp}%  購買免遊實測 RTP ${R.toFixed(1).padStart(5)}%  ` +
      `平均免遊場次 ${avgSpins.toFixed(1)}  最大單輪 ${Math.round(best).toLocaleString()}x`);
  }
  console.log('');
}
console.log(fail===0
  ? '🎉 購買免遊折損率與記錄值相符（UI 上揭露的數字仍然正確）'
  : `⚠️ ${fail} 組偏離記錄值 — 請重新量測並更新 engine.mjs 的 BUY_RTP_RATIO 與頁面揭露文案`);
process.exit(fail===0?0:1);
