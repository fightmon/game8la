// 驗證掉落消除（cascade）的重力行為是否正確：
//   消除後，同一欄「沒被消掉的符號」必須原封不動往下沉、相對順序不變，
//   只有欄位頂端才會補新符號。若整欄都被換掉＝重力壞了。
import { createGame, mulberry32, COLS, ROWS, TOTAL } from '../public/lubu/engine.mjs';

const g = createGame({ rtp: 96, vol: 'mid', rng: mulberry32(2026) });
const key = c => (c ? c.kind + ':' + c.id + (c.value != null ? ':' + c.value : '') : 'null');

let checked = 0, bad = 0, survivorTotal = 0, newTotal = 0;

for (let n = 0; n < 30000 && checked < 4000; n++) {
  const r = g.spin(20);
  for (const step of r.steps) {
    const before = step.before, after = step.after;
    const removed = new Set(step.matches.flatMap(m => m.positions));

    for (let c = 0; c < COLS; c++) {
      // 消除前，這一欄由上到下「存活」的符號
      const survivors = [];
      for (let row = 0; row < ROWS; row++) {
        const i = row * COLS + c;
        if (!removed.has(i)) survivors.push(key(before[i]));
      }
      // 消除後，這一欄由上到下的符號
      const now = [];
      for (let row = 0; row < ROWS; row++) now.push(key(after[row * COLS + c]));

      // 存活者應該原序沉到欄底 → after 的「尾端」必須等於 survivors
      const tail = now.slice(ROWS - survivors.length);
      const ok = tail.length === survivors.length && tail.every((v, k) => v === survivors[k]);
      if (!ok) {
        bad++;
        if (bad <= 3) {
          console.log(`❌ 第 ${n} 轉、第 ${c} 欄重力錯誤`);
          console.log(`   消除前存活(由上到下)：${survivors.join(' | ')}`);
          console.log(`   消除後欄位(由上到下)：${now.join(' | ')}`);
        }
      }
      survivorTotal += survivors.length;
      newTotal += ROWS - survivors.length;
      checked++;
    }
  }
}

console.log(`\n檢查了 ${checked.toLocaleString()} 個「欄 × 消除步驟」`);
console.log(`平均每次消除：${(survivorTotal / checked).toFixed(2)} 格保留下沉、${(newTotal / checked).toFixed(2)} 格頂端補新`);
console.log(bad === 0
  ? '✅ 重力正確：存活符號原序下沉，只有頂端補新'
  : `❌ ${bad} 個欄位重力錯誤`);
process.exit(bad === 0 ? 0 : 1);
