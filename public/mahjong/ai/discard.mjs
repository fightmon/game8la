// AI 打牌與鳴牌判斷 — 教練模式共用同一顆腦
// 策略 v1（進攻型）：向聽最低 → 進張最多 → 平手時先丟字牌/邊張
import { shanten } from '../core/shanten.mjs';
import { usefulTiles } from '../core/ukeire.mjs';
import { KINDS } from '../core/tiles.mjs';
import { dangerOf, threatOf } from './defense.mjs';

/** 平手時的捨牌傾向：字牌 > 19 > 28 > 中張（越大越先丟） */
function safetyBias(k) {
  if (k >= 27) return 3;
  const p = k % 9;
  if (p === 0 || p === 8) return 2;
  if (p === 1 || p === 7) return 1;
  return 0;
}

/**
 * 排序所有可打的牌。counts = 待打狀態手牌（(5-f)*3+2 張）。
 * 兩段式：先全算向聽（便宜），只對「向聽最低那群」算進張（貴），其餘給概略排序。
 * @returns [{kind, shanten, ukeire, kinds}] 由最好到最差
 */
export function rankDiscards(counts, fixedMelds = 0, visible = null, table = null) {
  const opts = [];
  let minS = Infinity;
  for (let k = 0; k < KINDS; k++) {
    if (counts[k] === 0) continue;
    counts[k]--;
    const s = shanten(counts, fixedMelds);
    counts[k]++;
    opts.push({ kind: k, shanten: s, ukeire: -1, kinds: 0, danger: 0, score: 0 });
    if (s < minS) minS = s;
  }
  for (const o of opts) {
    if (o.shanten !== minS) continue;
    counts[o.kind]--;
    const r = usefulTiles(counts, fixedMelds, visible);
    counts[o.kind]++;
    o.ukeire = r.totalLeft;
    o.kinds = r.tiles.length;
  }

  // 防守權重：自己越遠離聽牌、對手威脅越高 → 越該打安全牌
  let W = 0;
  if (table && table.seats) {
    let maxThreat = 0;
    for (const s of table.seats) {
      if (s.idx === table.meSeat) continue;
      maxThreat = Math.max(maxThreat, threatOf(s, table.turnsPlayed || 0));
    }
    W = maxThreat * (6 + Math.max(0, minS) * 13);
    if (W > 0) {
      for (const o of opts) {
        o.danger = dangerOf(o.kind, table.seats, table.meSeat, visible || [], table.turnsPlayed || 0);
      }
    }
  }
  for (const o of opts) o.score = o.ukeire - o.danger * W;

  opts.sort((a, b) =>
    a.shanten - b.shanten ||
    b.score - a.score ||
    b.ukeire - a.ukeire ||
    safetyBias(b.kind) - safetyBias(a.kind));
  return opts;
}

/** AI 打哪張（rankDiscards 第一名） */
export function chooseDiscard(counts, fixedMelds = 0, visible = null, table = null) {
  return rankDiscards(counts, fixedMelds, visible, table)[0];
}

/**
 * 槓判斷：槓完（會補一張）向聽不變差就槓。
 * @param counts 手牌
 * @param fixedMelds 已副露組數
 * @param opt { mode:'ankan'|'kakan'|'minkan', tile:int }
 */
export function evalKong(counts, fixedMelds, opt) {
  const before = shanten(counts, fixedMelds);
  const c = counts.slice();
  let f = fixedMelds;
  if (opt.mode === 'ankan') {
    if (c[opt.tile] < 4) return { take: false, before, after: Infinity };
    c[opt.tile] -= 4; f += 1;
  } else if (opt.mode === 'kakan') {
    if (c[opt.tile] < 1) return { take: false, before, after: Infinity };
    c[opt.tile] -= 1; // 面子數不變（碰→槓）
  } else { // minkan：手上3張＋別人打的那張
    if (c[opt.tile] < 3) return { take: false, before, after: Infinity };
    c[opt.tile] -= 3; f += 1;
  }
  const after = shanten(c, f);
  return { take: after <= before, before, after };
}

/**
 * 鳴牌判斷：碰/吃之後「打完一張的最佳向聽」是否嚴格進步。
 * counts = 未鳴狀態手牌（(5-f)*3+1 張）。
 * claim = { type:'pon'|'chow', tile:int, base?:int（吃的順子起點） }
 */
export function evalClaim(counts, fixedMelds, claim) {
  const now = shanten(counts, fixedMelds);
  const c = counts.slice();
  if (claim.type === 'pon') {
    if (c[claim.tile] < 2) return { take: false, before: now, after: Infinity };
    c[claim.tile] -= 2;
  } else {
    for (let d = 0; d < 3; d++) {
      const t = claim.base + d;
      if (t === claim.tile) continue;
      if (c[t] < 1) return { take: false, before: now, after: Infinity };
      c[t]--;
    }
  }
  let best = Infinity;
  for (let k = 0; k < KINDS; k++) {
    if (c[k] === 0) continue;
    c[k]--;
    const s = shanten(c, fixedMelds + 1);
    c[k]++;
    if (s < best) best = s;
  }
  return { take: best < now, before: now, after: best };
}
