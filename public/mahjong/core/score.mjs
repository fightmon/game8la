// 算台引擎 — 移植自 game8la mahjong-suan-tai-trainer.astro:356-435（已上線驗證過的邏輯）
// 增補：① 正花台（原版無花牌） ② ronFormed 旗標（胡別人補成的刻子不算暗刻、但不破門清）
//
// 面子格式：{ t:'1m'|'5z'…, kind:'pung'|'chow', exposed:bool, ronFormed?:bool }
//   t = 刻子的牌 / 順子的最小牌。花色 m=萬 p=筒 s=條 z=字(1東2南3西4北5中6發7白)

export const TAI = {
  qingYiSe: 8, hunYiSe: 4, ziYiSe: 16, pengPeng: 4, anke: { 3: 2, 4: 5, 5: 8 },
  dragon: 1, xiaoSanYuan: 4, daSanYuan: 8, quanFeng: 1, menFeng: 1,
  xiaoSiXi: 8, daSiXi: 16, menQing: 1, ziMo: 1, flower: 1,
  gangShang: 1, qiangGang: 1,
};

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HCH = { 1: '東', 2: '南', 3: '西', 4: '北', 5: '中', 6: '發', 7: '白' };

/* 面子建構器：P=暗刻 MP=明刻(碰) CH=順子(暗) MCH=吃來的順子 */
export function P(t)  { return { t, kind: 'pung', exposed: false }; }
export function MP(t) { return { t, kind: 'pung', exposed: true }; }
export function CH(t) { return { t, kind: 'chow', exposed: false }; }
export function MCH(t){ return { t, kind: 'chow', exposed: true }; }

export function meldTiles(m) {
  const n = +m.t[0], s = m.t[1];
  return m.kind === 'pung' ? [m.t, m.t, m.t] : [m.t, (n + 1) + s, (n + 2) + s];
}

const WHY = {
  '清一色': '整手都同一花色、沒有字牌', '混一色': '同一花色 + 字牌', '字一色': '整手都是字牌',
  '碰碰胡': '五副都是刻子、沒有順子', '大三元': '中、發、白各一刻（明暗都算）',
  '小三元': '中發白其中兩刻 + 第三個做對', '三元刻（中/發/白）': '中/發/白其中一種的刻子',
  '圈風刻': '這局圈風的刻子', '門風刻': '自己門風的刻子',
  '大四喜': '東南西北四刻', '小四喜': '三個風刻 + 一對風',
  '門清': '沒有吃、碰、明槓，整手自己摸成', '自摸': '最後一張自己摸到',
  '三暗刻': '三副自己摸成的暗刻（沒碰）', '四暗刻': '四副暗刻（沒碰）', '五暗刻': '五副暗刻（門清自摸碰碰胡）',
  '正花': '花牌對到自己門風（東=春梅、南=夏蘭、西=秋竹、北=冬菊）',
  '槓上開花': '槓完補進來的那張牌剛好自摸',
  '搶槓': '別人加槓的那張牌正好是你要胡的',
};

/**
 * @param melds 5 副面子
 * @param pair  將牌（如 '5z'）
 * @param ctx   { round:1-4, seat:1-4, selfDraw:bool, flowers?:number[]（1-8） }
 * @returns { total, lines:[{name,tai,why,groups,pairRef}] }
 */
export function scoreHand(melds, pair, ctx) {
  const lines = [];
  const idxAll = melds.map((_, i) => i);
  const all = [];
  melds.forEach(m => { meldTiles(m).forEach(t => all.push(t)); });
  all.push(pair, pair);
  const numSuits = new Set(all.filter(t => t[1] !== 'z').map(t => t[1]));
  const hasHonor = all.some(t => t[1] === 'z');
  const pungIdx = [];
  melds.forEach((m, i) => { if (m.kind === 'pung') pungIdx.push(i); });
  // 暗刻：非碰來、且非「胡別人補成」的刻子
  const concealedPungIdx = pungIdx.filter(i => !melds[i].exposed && !melds[i].ronFormed);
  // 門清：只看有沒有吃碰（exposed）；榮和不破門清
  const allConcealed = melds.every(m => !m.exposed);
  const push = (name, tai, groups, pairRef, why) =>
    lines.push({ name, tai, why: why || WHY[name] || '', groups: groups || [], pairRef: !!pairRef });

  if (numSuits.size === 0) push('字一色', TAI.ziYiSe, idxAll, true);
  else if (numSuits.size === 1 && hasHonor) push('混一色', TAI.hunYiSe, idxAll, true);
  else if (numSuits.size === 1 && !hasHonor) push('清一色', TAI.qingYiSe, idxAll, true);

  if (pungIdx.length === 5) push('碰碰胡', TAI.pengPeng, pungIdx, false);

  if (concealedPungIdx.length >= 3) {
    const k = concealedPungIdx.length;
    if (TAI.anke[k]) push(CN[k] + '暗刻', TAI.anke[k], concealedPungIdx, false);
  }

  const dragonIdx = pungIdx.filter(i => melds[i].t[1] === 'z' && +melds[i].t[0] >= 5);
  const dragonPair = (pair[1] === 'z' && +pair[0] >= 5);
  if (dragonIdx.length === 3) push('大三元', TAI.daSanYuan, dragonIdx, false);
  else if (dragonIdx.length === 2 && dragonPair) push('小三元', TAI.xiaoSanYuan, dragonIdx, true);
  else dragonIdx.forEach(i => push('三元刻（中/發/白）', TAI.dragon, [i], false));

  const windIdx = pungIdx.filter(i => melds[i].t[1] === 'z' && +melds[i].t[0] <= 4);
  const windPair = (pair[1] === 'z' && +pair[0] <= 4);
  if (windIdx.length === 4) push('大四喜', TAI.daSiXi, windIdx, false);
  else if (windIdx.length === 3 && windPair) push('小四喜', TAI.xiaoSiXi, windIdx, true);
  else windIdx.forEach(i => {
    const w = +melds[i].t[0];
    if (w === ctx.round) push('圈風刻', TAI.quanFeng, [i], false, '圈風 ' + HCH[ctx.round] + ' 的刻子（+1 台）');
    if (w === ctx.seat) push('門風刻', TAI.menFeng, [i], false, '門風 ' + HCH[ctx.seat] + ' 的刻子（+1 台）');
  });

  if (allConcealed) push('門清', TAI.menQing, idxAll, true);
  if (ctx.selfDraw) push('自摸', TAI.ziMo, [], false);
  if (ctx.afterKong) push('槓上開花', TAI.gangShang, [], false);
  if (ctx.robKong) push('搶槓', TAI.qiangGang, [], false);

  // 正花（引擎增補）：花牌 1-8 對到門風（東=1,5 南=2,6 西=3,7 北=4,8）各 +1 台
  if (ctx.flowers && ctx.flowers.length) {
    for (const f of ctx.flowers) {
      if (f === ctx.seat || f === ctx.seat + 4) push('正花', TAI.flower, [], false);
    }
  }

  const total = lines.reduce((s, l) => s + l.tai, 0);
  return { total, lines };
}
