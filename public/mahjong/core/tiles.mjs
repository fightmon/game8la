// 台灣16張麻將 — 牌表示法
// 0-8: 1-9萬, 9-17: 1-9筒, 18-26: 1-9條, 27-33: 東南西北中發白
// 花牌不進手牌陣列（摸到即補花亮出，另計 flowers[]），向聽引擎完全不用管花牌。

export const KINDS = 34;

const HONOR_NAMES = ['東', '南', '西', '北', '中', '發', '白'];
export const TILE_NAMES = [];
for (let i = 0; i < 9; i++) TILE_NAMES.push((i + 1) + '萬');
for (let i = 0; i < 9; i++) TILE_NAMES.push((i + 1) + '筒');
for (let i = 0; i < 9; i++) TILE_NAMES.push((i + 1) + '條');
TILE_NAMES.push(...HONOR_NAMES);

export function emptyCounts() { return new Array(KINDS).fill(0); }

const SUIT_BASE = { '萬': 0, '筒': 9, '條': 18 };

/** parse('123萬 55筒 78條 東東 白') → counts[34] */
export function parse(str) {
  const counts = emptyCounts();
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok) continue;
    const suit = tok[tok.length - 1];
    if (suit in SUIT_BASE) {
      const base = SUIT_BASE[suit];
      for (const ch of tok.slice(0, -1)) {
        const n = ch.charCodeAt(0) - 48;
        if (n < 1 || n > 9) throw new Error('bad tile token: ' + tok);
        counts[base + n - 1]++;
      }
    } else {
      for (const ch of tok) {
        const h = HONOR_NAMES.indexOf(ch);
        if (h < 0) throw new Error('bad honor token: ' + tok);
        counts[27 + h]++;
      }
    }
  }
  return counts;
}

/** counts[34] → '1萬 2萬 …' 可讀字串 */
export function fmt(counts) {
  const parts = [];
  for (let i = 0; i < KINDS; i++)
    for (let c = 0; c < counts[i]; c++) parts.push(TILE_NAMES[i]);
  return parts.join(' ');
}

export function total(counts) { return counts.reduce((a, b) => a + b, 0); }
