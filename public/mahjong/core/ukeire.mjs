// 進張計算：摸哪些牌能讓向聽數前進一步 + 各剩幾張
import { KINDS } from './tiles.mjs';
import { shanten } from './shanten.mjs';

/**
 * @param counts 手牌[34]（等牌型張數）
 * @param fixedMelds 副露組數
 * @param visible 場上已見張數[34]（牌河+副露+自己手牌以外的可見資訊），可省略
 * @returns { shanten, tiles:[{kind,left}], totalLeft }
 */
export function usefulTiles(counts, fixedMelds = 0, visible = null) {
  const base = shanten(counts, fixedMelds);
  const tiles = [];
  let totalLeft = 0;
  for (let k = 0; k < KINDS; k++) {
    if (counts[k] >= 4) continue;
    if (!isCandidate(counts, k)) continue;
    counts[k]++;
    const s = shanten(counts, fixedMelds);
    counts[k]--;
    if (s < base) {
      const left = Math.max(0, 4 - counts[k] - (visible ? (visible[k] || 0) : 0));
      tiles.push({ kind: k, left });
      totalLeft += left;
    }
  }
  return { shanten: base, tiles, totalLeft };
}

/** 只有「與持牌同種」或「同花色距離 ≤2 的數牌」可能是進張（孤立新牌不可能降向聽） */
function isCandidate(counts, k) {
  if (counts[k] > 0) return true;
  if (k >= 27) return false;
  const pos = k % 9, base = k - pos;
  for (let d = -2; d <= 2; d++) {
    const q = pos + d;
    if (q < 0 || q > 8) continue;
    if (counts[base + q] > 0) return true;
  }
  return false;
}
