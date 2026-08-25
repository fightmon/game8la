// 防守：對手威脅度估計 + 每張牌的放槍危險度
// 用麻將實務常識（現物／筋／壁／字牌見數／副露形），非機率模型；供 AI 取捨與教練說明。
import { KINDS } from '../core/tiles.mjs';

/**
 * 對手威脅度 0~1（越高越像聽牌）。
 * 依據：副露組數、是否偏一色、河裡是否已不打中張（轉守/已成形）。
 */
export function threatOf(seat, turnsPlayed) {
  let t = 0;
  const melds = seat.melds.length;
  t += Math.min(melds, 4) * 0.16;                       // 副露越多越接近
  // 副露偏同一花色（做混一/清一色）
  if (melds >= 2) {
    const suits = new Set(seat.melds.filter(m => m.base < 27).map(m => Math.floor(m.base / 9)));
    const hasHonor = seat.melds.some(m => m.base >= 27);
    if (suits.size === 1 && (hasHonor || melds >= 3)) t += 0.18;
  }
  // 三元牌刻子＝大牌傾向
  if (seat.melds.some(m => m.base >= 31 && m.kind !== 'chow')) t += 0.1;
  // 巡數（打越久越可能聽牌）
  t += Math.min(turnsPlayed / 18, 1) * 0.3;
  // 河裡最近 6 張都是字牌/么九 → 手牌已成形只留安全牌
  const tail = seat.river.slice(-6);
  if (tail.length >= 4) {
    const outer = tail.filter(k => k >= 27 || k % 9 === 0 || k % 9 === 8).length;
    if (outer / tail.length >= 0.7) t += 0.12;
  }
  return Math.max(0, Math.min(1, t));
}

/**
 * 單一對手視角下，打 kind 的危險度 0~1。
 * 0=現物（絕對安全）；字牌看見數；數牌看中張/筋/壁。
 */
export function dangerAgainst(kind, seat, visible) {
  // 現物：他自己打過 → 不可能胡（本局不考慮過水後解除）
  if (seat.river.includes(kind)) return 0;
  const seen = visible[kind] || 0;
  if (kind >= 27) {
    // 字牌：看得到越多越安全（4 張全見＝0）
    return Math.max(0, (3 - seen) / 3) * 0.55;
  }
  const pos = kind % 9, base = kind - pos;
  // 基礎：中張最危險
  let d = [0.45, 0.6, 0.75, 0.9, 1.0, 0.9, 0.75, 0.6, 0.45][pos];
  // 筋：他打過 X → X±3 兩面聽的機會降低
  const sujiLow = pos >= 3 && seat.river.includes(base + pos - 3);
  const sujiHigh = pos <= 5 && seat.river.includes(base + pos + 3);
  if (pos <= 2 && sujiHigh) d *= 0.55;          // 1-3：看上筋
  else if (pos >= 6 && sujiLow) d *= 0.55;      // 7-9：看下筋
  else if (sujiLow && sujiHigh) d *= 0.45;      // 中張雙筋
  else if (sujiLow || sujiHigh) d *= 0.8;
  // 壁：關鍵連接牌全見 → 兩面聽不成立
  const wallAt = q => (q >= 0 && q <= 8) && (visible[base + q] || 0) >= 4;
  if ((pos >= 2 && wallAt(pos - 2)) || (pos <= 6 && wallAt(pos + 2))) d *= 0.65;
  // 自己看見越多，對方持有越少
  d *= (1 - Math.min(seen, 3) * 0.12);
  return Math.max(0, Math.min(1, d));
}

/** 綜合三家：加權危險度 0~1 */
export function dangerOf(kind, seats, meSeat, visible, turnsPlayed) {
  let worst = 0, sum = 0;
  for (let i = 0; i < 4; i++) {
    if (i === meSeat) continue;
    const s = seats[i];
    const risk = dangerAgainst(kind, s, visible) * threatOf(s, turnsPlayed);
    sum += risk;
    if (risk > worst) worst = risk;
  }
  // 以最危險的一家為主，其餘加成
  return Math.max(0, Math.min(1, worst * 0.75 + (sum / 3) * 0.25));
}

export function dangerLabel(d) {
  return d < 0.12 ? '安全' : d < 0.28 ? '低' : d < 0.5 ? '中' : '高';
}
