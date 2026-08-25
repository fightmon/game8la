// 牌面繪圖 — 與 game8la 算台練習器同一套（UI 統一）
// 萬＝漢字數字＋萬、1索＝鳥、1筒＝大餅、其餘筒點/索竹、字牌＝漢字
// kind: 0-8=1~9萬, 9-17=1~9筒, 18-26=1~9條, 27-33=東南西北中發白

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HCH = ['東', '南', '西', '北', '中', '發', '白'];
const HCOL = ['#1d4ee8', '#1d4ee8', '#1d4ee8', '#1d4ee8', '#c0282d', '#1e7a46', '#2b7bb0'];

function grid(n) {
  const L = 24, C = 36, R = 48;
  return ({
    1: [[C, 50]], 2: [[C, 30], [C, 70]], 3: [[L, 28], [C, 50], [R, 72]],
    4: [[L, 30], [R, 30], [L, 70], [R, 70]],
    5: [[L, 30], [R, 30], [C, 50], [L, 70], [R, 70]],
    6: [[L, 28], [R, 28], [L, 50], [R, 50], [L, 72], [R, 72]],
    7: [[L, 26], [R, 26], [L, 50], [C, 50], [R, 50], [L, 74], [R, 74]],
    8: [[L, 24], [R, 24], [L, 42], [R, 42], [L, 60], [R, 60], [L, 78], [R, 78]],
    9: [[L, 26], [C, 26], [R, 26], [L, 50], [C, 50], [R, 50], [L, 74], [C, 74], [R, 74]],
  })[n];
}

/** 筒的傳統排法：7筒＝上排 3 顆斜列（綠）＋下方 2×2 共 4 顆（紅） */
const PIN_GRID = {
  7: [[22, 20], [36, 28], [50, 36], [24, 58], [48, 58], [24, 78], [48, 78]],
};
const PIN_COLS = {
  7: ['#1e7a46', '#1e7a46', '#1e7a46', '#c0282d', '#c0282d', '#c0282d', '#c0282d'],
};
function pin(n) {
  const cols = ['#1e7a46', '#c0282d', '#1d4ee8'];
  const pts = PIN_GRID[n] || grid(n);
  return pts.map((p, i) => {
    const x = p[0], y = p[1], r = n === 1 ? 16 : 7.5;
    const col = n === 1 ? '#c0282d' : (PIN_COLS[n] ? PIN_COLS[n][i] : cols[i % 3]);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${col}" stroke-width="${n === 1 ? 3 : 2.4}"/>`
      + `<circle cx="${x}" cy="${y}" r="${(r * 0.42).toFixed(2)}" fill="${col}"/>`;
  }).join('');
}

/** 索的傳統排法：7索＝上 1（紅）＋中 3＋下 3，與筒的排法不同 */
const SOU_GRID = {
  7: [[36, 22], [24, 50], [36, 50], [48, 50], [24, 76], [36, 76], [48, 76]],
};
function bambooStick(x, y, col) {
  return `<g><rect x="${x - 3}" y="${y - 11}" width="6" height="22" rx="3" fill="${col}"/>`
    + `<rect x="${x - 4.4}" y="${y - 3}" width="8.8" height="2.6" rx="1.3" fill="${col === '#c0282d' ? '#7d1a18' : '#0c5c30'}"/>`
    + `<rect x="${x - 4.4}" y="${y + 5}" width="8.8" height="2.6" rx="1.3" fill="${col === '#c0282d' ? '#7d1a18' : '#0c5c30'}"/></g>`;
}
function sou(n) {
  if (n === 1) return '<g transform="translate(36,50)">'
    + '<ellipse cx="0" cy="7" rx="12" ry="15" fill="#1e7a46"/>'
    + '<circle cx="0" cy="-11" r="7.5" fill="#c0282d"/>'
    + '<path d="M0 15 L-5 28 L5 28 Z" fill="#e0a020"/>'
    + '<circle cx="-2.5" cy="-12" r="1.5" fill="#fff"/></g>';
  const pts = SOU_GRID[n] || grid(n);
  // 7 索的最上面那根傳統上是紅色
  return pts.map((p, i) =>
    bambooStick(p[0], p[1], (n === 7 && i === 0) ? '#c0282d' : '#1e7a46')
  ).join('');
}

function wan(n) {
  return `<text x="36" y="40" font-size="25" text-anchor="middle" fill="#c0282d" font-family="serif" font-weight="700">${CN[n]}</text>`
    + `<text x="36" y="76" font-size="29" text-anchor="middle" fill="#1b3a2a" font-family="serif" font-weight="800">萬</text>`;
}

function honor(i) {
  return `<text x="36" y="63" font-size="40" text-anchor="middle" fill="${HCOL[i]}" font-family="serif" font-weight="800">${HCH[i]}</text>`;
}

/** 牌面 SVG（含牌身與陰影），viewBox 0 0 72 98 */
export function tileFaceSVG(kind) {
  let inner;
  if (kind < 9) inner = wan(kind + 1);
  else if (kind < 18) inner = pin(kind - 8);
  else if (kind < 27) inner = sou(kind - 17);
  else inner = honor(kind - 27);
  return '<svg class="tface" viewBox="0 0 72 98" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="3" y="8" width="66" height="88" rx="9" fill="url(#mjShade)"/>'
    + '<rect x="3" y="3" width="66" height="86" rx="9" fill="url(#mjFace)" stroke="#d9cdaf"/>'
    + inner + '</svg>';
}

/** 頁面只需插入一次的漸層定義 */
export const TILE_DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">'
  + '<defs><linearGradient id="mjFace" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#ece4cf"/></linearGradient>'
  + '<linearGradient id="mjShade" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#e9dcc0"/><stop offset="1" stop-color="#bda77f"/></linearGradient>'
  + '</defs></svg>';
