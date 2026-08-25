// 戰神呂布 模擬器引擎（純邏輯，無 DOM）
// 頁面 /tools/lu-bu-simulator/ 與 scripts/lubu-rtp-test.mjs 共用同一份數學。
// 規格依據站內攻略頁 /games/god-of-war-lubu/：
//   6 軸 × 5 列自由配對（Scatter Pays，同符號 ≥8 個中獎）+ 掉落消除
//   倍數符號 綠2-5x / 藍5-10x / 紫10-50x / 紅50-500x，相加後乘上獎金
//   4 個以上 Bonus 觸發 15 場 Free Game，FG 內倍數鎖定累積、最多 100 場
//   獎金公式：押注額 ÷ 20 × 賠率

export const COLS = 6;
export const ROWS = 5;
export const TOTAL = COLS * ROWS;

/** 單轉贏分上限（總押注的倍數），比照官方 51,000 倍 */
export const MAX_WIN_X = 51000;

/** 賠率基準：押注 ÷ PAY_DIV × 賠率 */
export const PAY_DIV = 20;

/** 九種一般符號。w = 基礎權重；plate = 需要程式補的金框底色（null 表示圖檔自帶框） */
export const SYMS = [
  { id: 'horse',   name: '赤兔馬',     img: '/images/lubu/horse.webp',   tier: 'hi', plate: '#7e1a10', w: 4.1, pay: { 8: 200, 10: 500, 12: 1000 } },
  { id: 'halberd', name: '方天畫戟',   img: '/images/lubu/halberd.webp', tier: 'hi', plate: '#41215e', w: 5.1, pay: { 8: 50,  10: 200, 12: 500 } },
  { id: 'flag',    name: '戰旗',       img: '/images/lubu/flag.webp',    tier: 'hi', plate: '#6d3d0c', w: 6.3, pay: { 8: 40,  10: 100, 12: 300 } },
  { id: 'token',   name: '令符',       img: '/images/lubu/token.webp',   tier: 'hi', plate: null,      w: 7.6, pay: { 8: 30,  10: 40,  12: 240 } },
  { id: 'gem1',    name: '紅芭樂寶石', img: '/images/lubu/gem1.webp',    tier: 'lo', plate: null, w: 9.0,  pay: { 8: 20, 10: 30, 12: 200 } },
  { id: 'gem2',    name: '紫芭樂寶石', img: '/images/lubu/gem2.webp',    tier: 'lo', plate: null, w: 10.5, pay: { 8: 16, 10: 24, 12: 160 } },
  { id: 'gem3',    name: '黃芭樂寶石', img: '/images/lubu/gem3.webp',    tier: 'lo', plate: null, w: 12.0, pay: { 8: 10, 10: 20, 12: 100 } },
  { id: 'gem4',    name: '綠芭樂寶石', img: '/images/lubu/gem4.webp',    tier: 'lo', plate: null, w: 13.0, pay: { 8: 8,  10: 18, 12: 80 } },
  { id: 'gem5',    name: '藍芭樂寶石', img: '/images/lubu/gem5.webp',    tier: 'lo', plate: null, w: 14.0, pay: { 8: 5,  10: 15, 12: 40 } },
];

/** 倍數符號：四色，各自帶隨機倍數區間（對齊攻略頁） */
export const MULTIS = [
  { id: 'mg', name: '綠倍數', img: '/images/lubu/multi2.webp', color: '#7ee72f', min: 2,  max: 5,   w: 62 },
  { id: 'mb', name: '藍倍數', img: '/images/lubu/multi3.webp', color: '#32a4fc', min: 5,  max: 10,  w: 27 },
  { id: 'mp', name: '紫倍數', img: '/images/lubu/multi1.webp', color: '#d23efa', min: 10, max: 50,  w: 9.5 },
  { id: 'mr', name: '紅倍數', img: '/images/lubu/multi4.webp', color: '#f97c27', min: 50, max: 500, w: 1.5 },
];

export const BONUS = { id: 'bonus', name: 'BONUS（芭樂子）', img: '/images/lubu/bonus.webp', color: '#ffcc33' };

/** 4 級累積彩金：機率與賠付都公開，不做暗箱 */
export const JACKPOTS = [
  { id: 'grand', name: 'GRAND', oneIn: 1000000, mult: 5000, color: '#ffd54a' },
  { id: 'major', name: 'MAJOR', oneIn: 50000,   mult: 500,  color: '#ff8a3d' },
  { id: 'minor', name: 'MINOR', oneIn: 5000,    mult: 50,   color: '#4fc3f7' },
  { id: 'mini',  name: 'MINI',  oneIn: 1000,    mult: 10,   color: '#81c784' },
];
/** 彩金佔掉的 RTP（5000/1e6 + 500/5e4 + 50/5e3 + 10/1e3 = 3.5%） */
export const JACKPOT_RTP = JACKPOTS.reduce((s, j) => s + j.mult / j.oneIn, 0) * 100;

/** 波動度：只改「賠率分佈的形狀」，不改長期 RTP（RTP 由 payK 收斂） */
export const VOL = {
  //  cascadeMulti：連鎖「補位」時倍數符號的出現倍率——這是尾巴（爆分）的真正來源。
  //          連鎖越長 → 補位次數越多 → 倍數疊越多 → 雪球。低波動設 0＝補位不長倍數，尾巴自然變薄。
  //  spread：符號權重的集中度。>1 集中（常見符號更常見→容易湊滿 8 個→中獎頻繁但金額小）
  //          <1 攤平（沒有哪個符號特別常見→難湊滿→中獎稀少但靠倍數爆大的）
  low:  { name: '低波動', hiW: 1.00, spread: 1.42, bonusW: 0.70, multiW: 1.15, multiHi: 0.08, fgBoost: 1.00, cascadeMulti: 0.00 },
  mid:  { name: '中波動', hiW: 1.00, spread: 1.10, bonusW: 1.00, multiW: 0.72, multiHi: 1.00, fgBoost: 1.90, cascadeMulti: 1.00 },
  high: { name: '高波動', hiW: 1.00, spread: 0.70, bonusW: 1.30, multiW: 0.38, multiHi: 5.50, fgBoost: 2.80, cascadeMulti: 1.90 },
};

/** Free Game 觸發即時獎金（× 總押注） */
const FG_INSTANT = { 4: 3, 5: 5, 6: 100 };
const FG_SPINS = 15;
const FG_RETRIGGER = 5;
const FG_MAX = 100;
export const BUY_COST_X = 100;

/**
 * 「購買免遊」相對於一般旋轉的 RTP 折損率，由 scripts/lubu-buy-test.mjs 實測而得。
 * 售價固定 100x（比照官方），但免遊值不值 100x 取決於倍數雪球滾得多大：
 *   低波動沒有雪球（fgBoost=1、cascadeMulti=0）→ 買免遊等於用 100x 換一輪不會爆的免遊，實際 RTP 只剩約八成。
 * 這個數字不藏起來，直接標在按鈕上——「買免遊」在多數機台就是這樣一個看不見的抽水點。
 */
export const BUY_RTP_RATIO = { low: 0.79, mid: 1.00, high: 0.98 };

const SYM_W_SUM = SYMS.reduce((a, s) => a + s.w, 0);
const BASE_BONUS_W = 1.70;
const BASE_MULTI_W = 0.30;
/** Free Game 期間倍數符號加倍出現——雪球效應留給免遊，這才是這款的靈魂。
 *  倍率依波動度而異（VOL[x].fgBoost）：低波動不滾雪球，高波動滾很大。 */

/**
 * 全域賠付係數。由 scripts/lubu-rtp-test.mjs 實測反推：
 * 在 payK=1 時三種波動度的自然 RTP 約 175%，故 payK ≈ 目標 / 自然。
 * 這裡存的是「payK=1 的自然 RTP（百分比）」，實際 payK 於執行時算。
 */
export const NATURAL_RTP = { low: 74.0, mid: 86.1, high: 155.9 };

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export { mulberry32 };

function pickWeighted(list, rng, key = 'w') {
  let total = 0;
  for (const it of list) total += it[key];
  let r = rng() * total;
  for (const it of list) { r -= it[key]; if (r <= 0) return it; }
  return list[list.length - 1];
}

/**
 * 建立一局遊戲。
 * @param {{rtp?:number, vol?:'low'|'mid'|'high', rng?:()=>number}} opts
 */
export function createGame(opts = {}) {
  let rtpTarget = opts.rtp ?? 96;
  let volKey = opts.vol ?? 'mid';
  const rng = opts.rng ?? Math.random;
  const useDrift = opts.drift !== false;   // 校準用：關掉短期修正才量得到自然 RTP
  const flatK = opts.flatPayK === true;    // 校準用：payK 固定為 1

  let totalBet = 0;
  let totalWin = 0;
  let spins = 0;
  let fgLeft = 0;
  let fgTotal = 0;
  let lockedMultis = [];      // FG 內鎖定累積的倍數值
  const jackpotHits = { grand: 0, major: 0, minor: 0, mini: 0 };

  /** 基礎遊戲要扛的 RTP（總目標扣掉彩金那 3.5%） */
  function baseTargetRtp() { return Math.max(40, rtpTarget - JACKPOT_RTP); }

  /**
   * 長期收斂修正：實測落後目標就加碼、超前就收斂。回傳 -1 ~ 1。
   * ⚠️ 只准接到 payK（賠付係數）這個「單調」槓桿上。
   *    早期版本把它接到符號權重，結果壓低高賠符號反而讓廉價寶石變多、連鎖變長、
   *    連鎖補位噴出更多倍數符號，RTP 不降反升 → 控制迴路正負回授搞反，出現雙穩態失控。
   */
  function drift() {
    if (!useDrift || spins < 80 || totalBet <= 0) return 0;
    const actual = (totalWin / totalBet) * 100;
    return Math.max(-1, Math.min(1, (rtpTarget - actual) / 5));
  }

  function payK() {
    if (flatK) return 1;
    // ±35% 的修正權限，足以吸收 NATURAL_RTP 常數本身的估計誤差（高波動肥尾難估準）
    return (baseTargetRtp() / NATURAL_RTP[volKey]) * (1 + drift() * 0.35);
  }

  function symWeights() {
    const v = VOL[volKey];
    return SYMS.map(s => ({ ...s, w: Math.pow(s.w, v.spread) * (s.tier === 'hi' ? v.hiW : 1) }));
  }

  function rollMulti() {
    const v = VOL[volKey];
    const list = MULTIS.map(m => ({
      ...m,
      w: (m.min >= 10 ? m.w * v.multiHi : m.w),
    }));
    const m = pickWeighted(list, rng);
    const value = Math.floor(rng() * (m.max - m.min + 1)) + m.min;
    return { kind: 'multi', id: m.id, img: m.img, color: m.color, value };
  }

  /** 抽一格。phase='refill'（連鎖補位）時不會再掉 Bonus，倍數出現率另受 cascadeMulti 控制 */
  function rollCell(phase, inFg) {
    const v = VOL[volKey];
    const syms = symWeights();
    const scale = syms.reduce((a, x) => a + x.w, 0) / SYM_W_SUM;   // pow 後的總權重歸一化
    const bw = phase === 'init' ? scale * BASE_BONUS_W * v.bonusW : 0;
    const mw = scale * BASE_MULTI_W * v.multiW * (inFg ? v.fgBoost : 1) * (phase === 'refill' ? v.cascadeMulti : 1);
    const pool = [
      ...syms.map(s => ({ pick: 'sym', s, w: s.w })),
      { pick: 'bonus', w: bw },
      { pick: 'multi', w: mw },
    ];
    const hit = pickWeighted(pool, rng);
    if (hit.pick === 'bonus') return { kind: 'bonus', id: 'bonus', img: BONUS.img };
    if (hit.pick === 'multi') return rollMulti();
    return { kind: 'sym', id: hit.s.id, img: hit.s.img };
  }

  function newBoard(inFg) {
    const b = new Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) b[i] = rollCell('init', inFg);
    return b;
  }

  /** 找出 ≥8 個的同符號（只看一般符號；Bonus 與倍數不參與消除） */
  function findMatches(board) {
    const bucket = {};
    for (let i = 0; i < TOTAL; i++) {
      const c = board[i];
      if (!c || c.kind !== 'sym') continue;
      (bucket[c.id] || (bucket[c.id] = [])).push(i);
    }
    const out = [];
    for (const id in bucket) {
      const pos = bucket[id];
      if (pos.length >= 8) out.push({ id, positions: pos, count: pos.length });
    }
    return out;
  }

  function payOf(symId, count, bet) {
    const s = SYMS.find(x => x.id === symId);
    const tier = count >= 12 ? 12 : count >= 10 ? 10 : 8;
    return (bet / PAY_DIV) * s.pay[tier] * payK();
  }

  /**
   * 消除後重力下落 + 頂部補位（補位不再產生 Bonus）。
   * 回傳 from[]：from[目的地] = 這格的來源索引，-1 表示是頂端補進來的新符號。
   * UI 靠這份對照表只讓「真的掉下來的格子」播落下動畫——
   * 否則整盤重畫會讓沒動過的符號也在跳，看起來就像每轉都換一整盤新符號。
   */
  function collapse(board, removed, inFg) {
    const gone = new Set(removed);
    const from = new Array(TOTAL).fill(-1);
    for (let c = 0; c < COLS; c++) {
      const keep = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        const i = r * COLS + c;
        if (!gone.has(i)) keep.push({ i, v: board[i] });   // 存索引也存值，避免就地覆寫時互相干擾
      }
      for (let r = ROWS - 1, k = 0; r >= 0; r--, k++) {
        const dst = r * COLS + c;
        if (k < keep.length) { board[dst] = keep[k].v; from[dst] = keep[k].i; }
        else { board[dst] = rollCell('refill', inFg); from[dst] = -1; }
      }
    }
    return from;
  }

  function countBonus(board) {
    let n = 0;
    for (const c of board) if (c && c.kind === 'bonus') n++;
    return n;
  }

  function boardMultis(board) {
    const out = [];
    for (let i = 0; i < TOTAL; i++) {
      const c = board[i];
      if (c && c.kind === 'multi') out.push({ idx: i, value: c.value, color: c.color });
    }
    return out;
  }

  function rollJackpot(bet) {
    for (const j of JACKPOTS) {           // 由大到小判，同一轉只中一級
      if (rng() < 1 / j.oneIn) {
        jackpotHits[j.id]++;
        return { tier: j.id, name: j.name, color: j.color, amount: bet * j.mult };
      }
    }
    return null;
  }

  /**
   * 轉一次。
   * @param {number} bet 總押注
   * @param {{buy?:boolean}} o buy=true 表示購買免遊（花 100 倍直接進 FG）
   */
  function spin(bet, o = {}) {
    const wasInFg = fgLeft > 0;
    let cost = 0;

    if (!wasInFg) {
      if (o.buy) { cost = bet * BUY_COST_X; fgLeft = FG_SPINS; fgTotal = FG_SPINS; lockedMultis = []; }
      else { cost = bet; lockedMultis = []; }
    }
    // 購買免遊後，「這一轉」就是免費遊戲第 1 場——不是先送一轉普通盤再進免遊
    const inFg = fgLeft > 0;

    totalBet += cost;
    spins++;

    const board = newBoard(inFg);
    const startBoard = board.map(c => ({ ...c }));
    const steps = [];
    let baseWin = 0;

    // 掉落消除連鎖
    for (let guard = 0; guard < 30; guard++) {
      const matches = findMatches(board);
      if (!matches.length) break;
      let stepWin = 0;
      const removed = [];
      for (const m of matches) {
        m.pay = payOf(m.id, m.count, bet);
        stepWin += m.pay;
        removed.push(...m.positions);
      }
      baseWin += stepWin;
      steps.push({ matches: matches.map(m => ({ ...m })), stepWin, before: board.map(c => ({ ...c })) });
      const from = collapse(board, removed, inFg);
      const last = steps[steps.length - 1];
      last.after = board.map(c => ({ ...c }));
      last.from = from;
    }

    // 倍數：盤面所有倍數相加（FG 內再加上先前鎖定的）
    const onBoard = boardMultis(board);
    const spinMultiSum = onBoard.reduce((s, m) => s + m.value, 0);
    const lockedSum = lockedMultis.reduce((s, v) => s + v, 0);
    const multiSum = spinMultiSum + lockedSum;

    let win = baseWin * (multiSum > 0 ? multiSum : 1);

    // Bonus / Free Game
    const bonusCount = countBonus(board);
    let fgTriggered = false, fgAdded = 0, instantWin = 0;
    if (!inFg && bonusCount >= 4) {   // 購買免遊時 inFg 已為 true，天然排除
      fgTriggered = true;
      fgLeft = FG_SPINS; fgTotal = FG_SPINS;
      instantWin = bet * (FG_INSTANT[Math.min(bonusCount, 6)] || 3);
      lockedMultis = [];
    } else if (inFg && bonusCount >= 3) {
      fgAdded = Math.min(FG_RETRIGGER, Math.max(0, FG_MAX - fgTotal));
      fgLeft += fgAdded; fgTotal += fgAdded;
    }
    win += instantWin;

    // 累積彩金
    const jackpot = rollJackpot(bet);
    if (jackpot) win += jackpot.amount;

    // 單轉上限
    const cap = bet * MAX_WIN_X;
    const capped = win > cap;
    if (capped) win = cap;

    if (inFg) { fgLeft--; for (const m of onBoard) lockedMultis.push(m.value); }

    totalWin += win;

    return {
      bet, cost, win, baseWin, multiSum, spinMultiSum, lockedSum,
      startBoard, steps, endBoard: board.map(c => ({ ...c })),
      onBoardMultis: onBoard,
      bonusCount, fgTriggered, fgAdded, instantWin, jackpot, capped,
      inFg, fgLeft, fgTotal,
      wasFreeSpin: inFg,
    };
  }

  return {
    spin,
    setRtp(v) { rtpTarget = v; },
    setVol(v) { volKey = v; },
    reset() { totalBet = 0; totalWin = 0; spins = 0; fgLeft = 0; fgTotal = 0; lockedMultis = []; },
    get state() {
      return {
        rtpTarget, volKey, totalBet, totalWin, spins, fgLeft, fgTotal,
        lockedMultis: lockedMultis.slice(),
        actualRtp: totalBet > 0 ? (totalWin / totalBet) * 100 : 0,
        jackpotHits: { ...jackpotHits },
        payK: payK(),
      };
    },
  };
}
