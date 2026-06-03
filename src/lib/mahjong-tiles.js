// 麻將牌面 SVG 渲染（原創向量，與 /tools/mahjong-suan-tai-trainer 同款牌面）
// 純函式、無 DOM 依賴 → 可在 Astro frontmatter build 時靜態渲染，也可未來給 game-core 共用。
//
// 牌字串格式：數字+花色   m萬 p筒 s條 z字 f花
//   z: 1東 2南 3西 4北 5中 6發 7白
//   f: 1春 2夏 3秋 4冬 5梅 6蘭 7竹 8菊

const CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const HCH = { 1: "東", 2: "南", 3: "西", 4: "北", 5: "中", 6: "發", 7: "白" };
const HCOL = { 1: "#1d4ee8", 2: "#1d4ee8", 3: "#1d4ee8", 4: "#1d4ee8", 5: "#c0282d", 6: "#1e7a46", 7: "#2b7bb0" };
const FCH = { 1: "春", 2: "夏", 3: "秋", 4: "冬", 5: "梅", 6: "蘭", 7: "竹", 8: "菊" };

function grid(n) {
  const L = 24, C = 36, R = 48;
  return ({
    1: [[C, 50]], 2: [[C, 30], [C, 70]], 3: [[L, 28], [C, 50], [R, 72]],
    4: [[L, 30], [R, 30], [L, 70], [R, 70]], 5: [[L, 30], [R, 30], [C, 50], [L, 70], [R, 70]],
    6: [[L, 28], [R, 28], [L, 50], [R, 50], [L, 72], [R, 72]],
    7: [[L, 26], [R, 26], [L, 50], [C, 50], [R, 50], [L, 74], [R, 74]],
    8: [[L, 24], [R, 24], [L, 42], [R, 42], [L, 60], [R, 60], [L, 78], [R, 78]],
    9: [[L, 26], [C, 26], [R, 26], [L, 50], [C, 50], [R, 50], [L, 74], [C, 74], [R, 74]]
  })[n];
}
function pin(n) {
  const cols = ["#1e7a46", "#c0282d", "#1d4ee8"];
  return grid(n).map(function (p, i) {
    const x = p[0], y = p[1], col = n === 1 ? "#c0282d" : cols[i % 3], r = n === 1 ? 16 : 7.5;
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#fff" stroke="' + col + '" stroke-width="' + (n === 1 ? 3 : 2.4) + '"/><circle cx="' + x + '" cy="' + y + '" r="' + (r * 0.42) + '" fill="' + col + '"/>';
  }).join("");
}
function sou(n) {
  if (n === 1) return '<g transform="translate(36,50)"><ellipse cx="0" cy="7" rx="12" ry="15" fill="#1e7a46"/><circle cx="0" cy="-11" r="7.5" fill="#c0282d"/><path d="M0 15 L-5 28 L5 28 Z" fill="#e0a020"/><circle cx="-2.5" cy="-12" r="1.5" fill="#fff"/></g>';
  return grid(n).map(function (p) {
    const x = p[0], y = p[1];
    return '<g><rect x="' + (x - 3) + '" y="' + (y - 11) + '" width="6" height="22" rx="3" fill="#1e7a46"/><rect x="' + (x - 4.4) + '" y="' + (y - 3) + '" width="8.8" height="2.6" rx="1.3" fill="#0c5c30"/><rect x="' + (x - 4.4) + '" y="' + (y + 5) + '" width="8.8" height="2.6" rx="1.3" fill="#0c5c30"/></g>';
  }).join("");
}
function wan(n) {
  return '<text x="36" y="40" font-size="25" text-anchor="middle" fill="#c0282d" font-family="serif" font-weight="700">' + CN[n] + '</text><text x="36" y="76" font-size="29" text-anchor="middle" fill="#1b3a2a" font-family="serif" font-weight="800">萬</text>';
}
function honor(n) {
  return '<text x="36" y="63" font-size="40" text-anchor="middle" fill="' + HCOL[n] + '" font-family="serif" font-weight="800">' + HCH[n] + '</text>';
}
function flower(n) {
  const col = n <= 4 ? "#c0282d" : "#1e7a46";
  return '<text x="22" y="30" font-size="16" text-anchor="middle" fill="' + col + '" font-family="serif" font-weight="700">' + n + '</text>'
    + '<text x="40" y="72" font-size="34" text-anchor="middle" fill="' + col + '" font-family="serif" font-weight="800">' + FCH[n] + '</text>';
}

/** 單張牌 → SVG 字串 */
export function tileSVG(t) {
  const n = +t[0], s = t[1];
  const inner = s === 'm' ? wan(n) : s === 'p' ? pin(n) : s === 's' ? sou(n) : s === 'f' ? flower(n) : honor(n);
  return '<svg viewBox="0 0 72 98" xmlns="http://www.w3.org/2000/svg"><defs>'
    + '<linearGradient id="mjfc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#ece4cf"/></linearGradient>'
    + '<linearGradient id="mjsd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9dcc0"/><stop offset="1" stop-color="#bda77f"/></linearGradient>'
    + '</defs><rect x="3" y="8" width="66" height="88" rx="9" fill="url(#mjsd)"/><rect x="3" y="3" width="66" height="86" rx="9" fill="url(#mjfc)" stroke="#d9cdaf"/>'
    + inner + '</svg>';
}

/** 面子 → 牌張陣列   {t, kind:'pung'|'chow'}  順子 = t,t+1,t+2 */
export function meldTiles(m) {
  const n = +m.t[0], s = m.t[1];
  return m.kind === 'pung' ? [m.t, m.t, m.t] : [m.t, (n + 1) + s, (n + 2) + s];
}

/** 一排牌張字串 → 連續 SVG */
export function tileRow(str) {
  return (str.replace(/\s+/g, '').match(/.{2}/g) || []).map(tileSVG).join('');
}
