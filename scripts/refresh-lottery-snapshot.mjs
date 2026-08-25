// 重建首頁/數據站的靜態開獎快照（fallback 用）
// 直接打台彩官方 API，逐月抓取，重建 public/data/*.json
// 執行：node scripts/refresh-lottery-snapshot.mjs [月數，預設 10]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'data');
const BASE = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery';
const MONTHS = parseInt(process.argv[2], 10) || 10;

const GAMES = {
  'daily-cash-539': {
    endpoints: ['Daily539Result', 'DailyCash539Result', 'DailyCashResult', 'Cash539Result'],
    keys: ['daily539Res', 'dailyCash539Res', 'dailyCashRes', 'cash539Res'],
    take: 5,
  },
  'super-lotto': {
    endpoints: ['SuperLotto638Result'], keys: ['superLotto638Res'], take: 6, extra: 'area2',
  },
  'lotto649': {
    endpoints: ['Lotto649Result'], keys: ['lotto649Res'], take: 6, extra: 'special',
  },
};

function months(n) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function pick(json, keys) {
  for (const k of keys) {
    const v = json?.content?.[k] ?? json?.[k];
    if (Array.isArray(v) && v.length) return v;
  }
  // 保險：掃一遍 content 裡任何陣列
  const c = json?.content;
  if (c) for (const v of Object.values(c)) if (Array.isArray(v) && v.length && v[0]?.period != null) return v;
  return [];
}

async function fetchMonth(ep, month) {
  const url = `${BASE}/${ep}?period=&month=${month}&pageNum=1&pageSize=50`;
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 GAME8LA/1.0' } });
  if (!r.ok) return null;
  return r.json();
}

for (const [file, cfg] of Object.entries(GAMES)) {
  const seen = new Set();
  const draws = [];
  let usedEp = null;

  for (const month of months(MONTHS)) {
    let json = null;
    for (const ep of (usedEp ? [usedEp] : cfg.endpoints)) {
      try {
        const j = await fetchMonth(ep, month);
        if (j && pick(j, cfg.keys).length) { json = j; usedEp = ep; break; }
      } catch { /* 換下一個 endpoint */ }
    }
    if (!json) continue;
    for (const rec of pick(json, cfg.keys)) {
      const period = rec.period != null ? String(rec.period) : null;
      if (!period || seen.has(period)) continue;
      const all = rec.drawNumberSize || rec.drawNumberAppear || [];
      if (!all.length) continue;
      const d = {
        period,
        date: (rec.lotteryDate || '').slice(0, 10),
        numbers: all.slice(0, cfg.take).slice().sort((a, b) => a - b),
      };
      if (cfg.extra && all[cfg.take] != null) d[cfg.extra] = Number(all[cfg.take]);
      seen.add(period);
      draws.push(d);
    }
  }

  draws.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (Number(b.period) || 0) - (Number(a.period) || 0));
  if (!draws.length) { console.log(JSON.stringify({ file, error: '抓不到資料（endpoint 可能變了）', usedEp })); continue; }

  const out = { lastUpdated: draws[0].date, draws };
  fs.writeFileSync(path.join(OUT, `${file}.json`), JSON.stringify(out), 'utf8');
  console.log(JSON.stringify({
    file: `${file}.json`, endpoint: usedEp, 期數: draws.length,
    最新: `${draws[0].period} ${draws[0].date}`, 最舊: `${draws[draws.length - 1].period} ${draws[draws.length - 1].date}`,
  }));
}
