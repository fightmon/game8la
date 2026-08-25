// 台灣16張麻將 向聽數引擎
// 目標型：5 面子 + 1 對（胡牌 17 張）。副露 f 組後，手內需 M = 5 - f 組面子。
// 公式：S = 2M − 2·min(m,M) − min(t有效, M−min(m,M)) − (有將 ? 1 : 0)
//   m=完成面子, t=搭子(含多餘對子), 將=保留一組對子當對頭。
// 主演算法：逐花色枚舉所有 (m,t,p) 拆法（DFS＋快取＋Pareto 精簡）→ 四組合併取最小。

import { KINDS } from './tiles.mjs';

const suitCache = new Map();

/** 枚舉一個花色（9 種數牌）或字牌組（7 種）的所有 (面子, 搭子, 對子) 組合 */
function enumGroup(counts, isHonor) {
  const key = (isHonor ? 'z' : 's') + counts.join('');
  const hit = suitCache.get(key);
  if (hit) return hit;

  const found = new Set();
  const results = [];
  const c = counts.slice();
  const n = c.length;

  function leaf(m, t, p) {
    const k = m * 100 + t * 10 + p;
    if (!found.has(k)) { found.add(k); results.push([m, t, p]); }
  }
  function dfs(i, m, t, p) {
    while (i < n && c[i] === 0) i++;
    if (i >= n) { leaf(m, t, p); return; }
    // 刻子
    if (c[i] >= 3) { c[i] -= 3; dfs(i, m + 1, t, p); c[i] += 3; }
    // 順子（僅數牌）
    if (!isHonor && (i % 9) <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; dfs(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++;
    }
    // 對子
    if (c[i] >= 2) { c[i] -= 2; dfs(i, m, t, p + 1); c[i] += 2; }
    // 相鄰搭子（兩面/邊張）
    if (!isHonor && (i % 9) <= 7 && c[i + 1] > 0) {
      c[i]--; c[i + 1]--; dfs(i, m, t + 1, p); c[i]++; c[i + 1]++;
    }
    // 嵌張搭子
    if (!isHonor && (i % 9) <= 6 && c[i + 2] > 0) {
      c[i]--; c[i + 2]--; dfs(i, m, t + 1, p); c[i]++; c[i + 2]++;
    }
    // 當孤張捨棄
    c[i]--; dfs(i, m, t, p); c[i]++;
  }
  dfs(0, 0, 0, 0);

  // Pareto 精簡：三項皆 ≤ 且至少一項 < 的組合可捨（公式對 m,t,p 單調不減）
  const pruned = results.filter(a => !results.some(b =>
    b !== a && b[0] >= a[0] && b[1] >= a[1] && b[2] >= a[2] &&
    (b[0] > a[0] || b[1] > a[1] || b[2] > a[2])
  ));
  suitCache.set(key, pruned);
  return pruned;
}

function leafShanten(M, m, t, p) {
  const head = p > 0 ? 1 : 0;
  const m2 = Math.min(m, M);
  const tEff = t + Math.max(0, p - head);   // 多餘對子當搭子（對→刻）
  const t2 = Math.min(tEff, Math.max(0, M - m2));
  return 2 * M - 2 * m2 - t2 - head;
}

/**
 * 向聽數。counts = 手牌張數陣列[34]（不含花牌），fixedMelds = 已副露組數。
 * 認定手牌張數 = (5-f)*3 + 1（等牌型）或 +2（剛摸進，-1 即胡）。
 */
export function shanten(counts, fixedMelds = 0) {
  const M = 5 - fixedMelds;
  const g0 = enumGroup(counts.slice(0, 9), false);
  const g1 = enumGroup(counts.slice(9, 18), false);
  const g2 = enumGroup(counts.slice(18, 27), false);
  const g3 = enumGroup(counts.slice(27, 34), true);
  let best = Infinity;
  for (const a of g0) for (const b of g1) for (const s of g2) for (const d of g3) {
    const S = leafShanten(M,
      a[0] + b[0] + s[0] + d[0],
      a[1] + b[1] + s[1] + d[1],
      a[2] + b[2] + s[2] + d[2]);
    if (S < best) best = S;
  }
  return best;
}

export function isWin(counts, fixedMelds = 0) {
  return shanten(counts, fixedMelds) === -1;
}

// ── 獨立對照組：整手 34 格直接 DFS（慢、但與主演算法完全獨立，供交叉驗證） ──
export function shantenNaive(counts, fixedMelds = 0) {
  const M = 5 - fixedMelds;
  const c = counts.slice();
  let best = Infinity;
  const seen = new Set();
  function dfs(i, m, t, p) {
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) { const S = leafShanten(M, m, t, p); if (S < best) best = S; return; }
    const key = i + '|' + c.join('') + '|' + m + ',' + t + ',' + p;
    if (seen.has(key)) return; seen.add(key);
    const isHonor = i >= 27;
    if (c[i] >= 3) { c[i] -= 3; dfs(i, m + 1, t, p); c[i] += 3; }
    if (!isHonor && (i % 9) <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; dfs(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++;
    }
    if (c[i] >= 2) { c[i] -= 2; dfs(i, m, t, p + 1); c[i] += 2; }
    if (!isHonor && (i % 9) <= 7 && c[i + 1] > 0) { c[i]--; c[i + 1]--; dfs(i, m, t + 1, p); c[i]++; c[i + 1]++; }
    if (!isHonor && (i % 9) <= 6 && c[i + 2] > 0) { c[i]--; c[i + 2]--; dfs(i, m, t + 1, p); c[i]++; c[i + 2]++; }
    c[i]--; dfs(i, m, t, p); c[i]++;
  }
  dfs(0, 0, 0, 0);
  return best;
}
