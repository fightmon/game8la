// 胡牌自動分解＋高點原則
// 把胡牌手（手內張數陣列）拆成「(5−副露) 副面子 + 1 對」的所有拆法，
// 逐一算台取最高（含榮和時「胡牌張落在哪一組」的所有可能）。
import { scoreHand } from './score.mjs';

/** kind(0-33) → score.mjs 的字串表示（'1m'…'7z'） */
export function kindToStr(k) {
  if (k < 9) return (k + 1) + 'm';
  if (k < 18) return (k - 8) + 'p';
  if (k < 27) return (k - 17) + 's';
  return (k - 26) + 'z';
}
export function strToKind(t) {
  const n = +t[0], s = t[1];
  return s === 'm' ? n - 1 : s === 'p' ? 8 + n : s === 's' ? 17 + n : 26 + n;
}

/** 把 counts 全部拆成 need 副面子的所有拆法（每副 {kind:'pung'|'chow', base:int}） */
function decomposeMelds(counts, need) {
  const out = [];
  const cur = [];
  const c = counts.slice();
  function dfs(i) {
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) { if (cur.length === need) out.push(cur.slice()); return; }
    if (cur.length >= need) return; // 還有牌但面子已滿 → 死路
    // 刻子
    if (c[i] >= 3) {
      c[i] -= 3; cur.push({ kind: 'pung', base: i }); dfs(i);
      cur.pop(); c[i] += 3;
    }
    // 順子（同花色內）
    if (i < 27 && (i % 9) <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; cur.push({ kind: 'chow', base: i }); dfs(i);
      cur.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
    }
    // 沒有其他選擇：這張牌無處安放 → 此路不通（不 push 就 return）
  }
  dfs(0);
  return out;
}

/**
 * 胡牌算台（自動分解、高點原則）。
 * @param handCounts 手內牌[34]（含胡的那張；(5−副露)×3+2 張）
 * @param claimed    已副露面子 [{kind:'pung'|'chow', base:int}]（一律視為明）
 * @param ctx        { round, seat, selfDraw, winTile?:int(榮和時必填), flowers?:[] }
 * @returns 最高台的 { total, lines, melds, pair }；無法分解回傳 null
 */
export function scoreWin(handCounts, claimed, ctx) {
  const needMelds = 5 - claimed.length;
  // 槓在算台上視為刻子；暗槓算暗刻（exposed:false）、明槓/加槓算明刻
  const claimedMelds = claimed.map(m => ({
    t: kindToStr(m.base),
    kind: m.kind === 'chow' ? 'chow' : 'pung',
    exposed: m.kind === 'kong' ? !m.concealed : true,
  }));
  let best = null;

  for (let pk = 0; pk < 34; pk++) {
    if (handCounts[pk] < 2) continue;
    handCounts[pk] -= 2;
    const decomps = decomposeMelds(handCounts, needMelds);
    handCounts[pk] += 2;

    for (const d of decomps) {
      const inHand = d.map(m => ({ t: kindToStr(m.base), kind: m.kind, exposed: false }));
      const variants = [];
      if (ctx.selfDraw || ctx.winTile == null) {
        variants.push(inHand);
      } else {
        // 榮和：胡牌張必須落在「手內某一組」或將——逐一枚舉，落在刻子上該刻不算暗刻
        const w = ctx.winTile;
        let placed = false;
        d.forEach((m, i) => {
          const inThis = m.kind === 'pung' ? m.base === w
            : (w >= m.base && w <= m.base + 2 && Math.floor(w / 9) === Math.floor(m.base / 9));
          if (!inThis) return;
          placed = true;
          if (m.kind === 'pung') {
            const v = inHand.map((x, j) => j === i ? { ...x, ronFormed: true } : x);
            variants.push(v);
          } else {
            variants.push(inHand); // 落在順子：不影響暗刻
          }
        });
        if (pk === w) { variants.push(inHand); placed = true; } // 落在將
        if (!placed) continue; // 這個拆法容不下胡牌張 → 無效
      }
      for (const v of variants) {
        const melds = claimedMelds.concat(v);
        const r = scoreHand(melds, kindToStr(pk), ctx);
        if (!best || r.total > best.total) {
          best = { total: r.total, lines: r.lines, melds, pair: kindToStr(pk) };
        }
      }
    }
  }
  return best;
}
