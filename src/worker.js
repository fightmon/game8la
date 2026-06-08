// Cloudflare Worker entry — serves static assets + /api/lottery proxy
// Static site lives in ./dist (Astro build output)

const LOTTERY_BASE = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery';

// 取得 (台北時區) 的年月，格式 YYYY-MM；offset 為月份偏移
function taipeiMonth(offset = 0) {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  now.setUTCMonth(now.getUTCMonth() + offset);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// 每個遊戲：endpoint 名稱（可多個 fallback）+ response 中陣列 key + 解析器
const GAMES = {
  lotto649: {
    endpoints: ['Lotto649Result'],
    arrayKeys: ['lotto649Res'],
    parse(rec) {
      const all = rec.drawNumberSize || [];
      return {
        period: rec.period != null ? String(rec.period) : null,
        date: (rec.lotteryDate || '').slice(0, 10),
        numbers: all.slice(0, 6).slice().sort((a, b) => a - b),
        special: all[6] != null ? Number(all[6]) : null,
      };
    },
  },
  super_lotto: {
    endpoints: ['SuperLotto638Result'],
    arrayKeys: ['superLotto638Res'],
    parse(rec) {
      const all = rec.drawNumberSize || [];
      return {
        period: rec.period != null ? String(rec.period) : null,
        date: (rec.lotteryDate || '').slice(0, 10),
        numbers: all.slice(0, 6).slice().sort((a, b) => a - b),
        area2: all[6] != null ? Number(all[6]) : null,
      };
    },
  },
  daily_cash: {
    endpoints: ['Daily539Result', 'DailyCash539Result', 'DailyCashResult', 'Cash539Result'],
    arrayKeys: ['daily539Res', 'dailyCash539Res', 'dailyCashRes', 'cash539Res'],
    parse(rec) {
      const all = rec.drawNumberSize || rec.drawNumberAppear || [];
      return {
        period: rec.period != null ? String(rec.period) : null,
        date: (rec.lotteryDate || '').slice(0, 10),
        numbers: all.slice(0, 5).slice().sort((a, b) => a - b),
      };
    },
  },
  lotto3d: {
    // 3 星彩：3 位數字，每位 0-9
    endpoints: ['Lotto3DResult', '3DResult', 'Lotto3StarResult'],
    arrayKeys: ['lotto3DRes', 'lotto3dRes', 'lotto3starRes'],
    parse(rec) {
      let nums = rec.drawNumberSize || rec.drawNumberAppear || rec.drawNumber || [];
      if (typeof nums === 'string') nums = nums.split('').map(Number);
      if (typeof nums === 'number') nums = String(nums).padStart(3, '0').split('').map(Number);
      return {
        period: rec.period != null ? String(rec.period) : null,
        date: (rec.lotteryDate || '').slice(0, 10),
        numbers: Array.isArray(nums) ? nums.slice(0, 3).map(Number) : [],
      };
    },
  },
  lotto4d: {
    // 4 星彩：4 位數字
    endpoints: ['Lotto4DResult', '4DResult', 'Lotto4StarResult'],
    arrayKeys: ['lotto4DRes', 'lotto4dRes', 'lotto4starRes'],
    parse(rec) {
      let nums = rec.drawNumberSize || rec.drawNumberAppear || rec.drawNumber || [];
      if (typeof nums === 'string') nums = nums.split('').map(Number);
      if (typeof nums === 'number') nums = String(nums).padStart(4, '0').split('').map(Number);
      return {
        period: rec.period != null ? String(rec.period) : null,
        date: (rec.lotteryDate || '').slice(0, 10),
        numbers: Array.isArray(nums) ? nums.slice(0, 4).map(Number) : [],
      };
    },
  },
  bingo: {
    // BINGO BINGO 賓果賓果：每 5 分鐘 1 場、用 LatestBingoResult 取最新一場
    endpoints: ['LatestBingoResult'],
    skipMonth: true,
    // 不是陣列，是 content.lotteryBingoLatestPost 單一物件
    extractCustom(json) {
      return json?.content?.lotteryBingoLatestPost || null;
    },
    parse(rec) {
      const big = rec.bigShowOrder || [];
      const nums = big.map(n => Number(n)).filter(n => !isNaN(n));
      const sup = rec.prizeNum?.bullEye;
      return {
        period: rec.drawTerm != null ? String(rec.drawTerm) : null,
        date: (rec.dDate || '').slice(0, 10),
        numbers: nums,
        special: sup != null ? Number(sup) : null,
      };
    },
  },
};

function buildUrl(endpoint, month, opts = {}) {
  if (opts.skipMonth) {
    // BINGO 等不依月份的：嘗試用今天日期 + 大 pageSize
    return `${LOTTERY_BASE}/${endpoint}?period=&pageNum=1&pageSize=1`;
  }
  return `${LOTTERY_BASE}/${endpoint}?period=&month=${month}&pageNum=1&pageSize=50`;
}

function extractRecords(json, arrayKeys) {
  const content = json?.content;
  if (!content) return [];
  for (const k of arrayKeys || []) {
    if (Array.isArray(content[k]) && content[k].length > 0) {
      return content[k];
    }
  }
  return [];
}

const HISTORY_LIMIT = 5;

async function fetchGame(key, months) {
  const cfg = GAMES[key];
  const monthsToTry = cfg.skipMonth ? [null] : months;
  let collected = [];
  for (const month of monthsToTry) {
    for (const ep of cfg.endpoints) {
      try {
        const url = buildUrl(ep, month, { skipMonth: cfg.skipMonth });
        const res = await fetch(url, {
          cf: { cacheTtl: 600, cacheEverything: true },
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 GAME8LA/1.0' },
        });
        if (!res.ok) continue;
        const json = await res.json();
        if (cfg.extractCustom) {
          const rec = cfg.extractCustom(json);
          if (rec) {
            const parsed = cfg.parse(rec);
            if (parsed.numbers && parsed.numbers.length > 0) {
              return { ...parsed, history: [] };
            }
          }
          continue;
        }
        const records = extractRecords(json, cfg.arrayKeys);
        for (const r of records) {
          const parsed = cfg.parse(r);
          if (parsed.numbers && parsed.numbers.length > 0) collected.push(parsed);
          if (collected.length >= HISTORY_LIMIT) break;
        }
        if (collected.length >= HISTORY_LIMIT) break;
      } catch (e) { /* try next */ }
    }
    if (collected.length >= HISTORY_LIMIT) break;
  }
  if (collected.length === 0) return null;
  const [latest, ...history] = collected;
  return { ...latest, history };
}

async function handleLottery(request) {
  const url = new URL(request.url);
  const debug = url.searchParams.get('debug');

  const months = [taipeiMonth(0), taipeiMonth(-1), taipeiMonth(-2)];

  // 通用 fetch proxy：?debug=fetch&path=BingoResult?date=2026-04-06
  if (debug === 'fetch') {
    const path = url.searchParams.get('path');
    if (!path) return new Response('missing path', { status: 400 });
    try {
      const r = await fetch(`${LOTTERY_BASE}/${path}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 GAME8LA/1.0' },
      });
      const body = await r.text();
      return new Response(JSON.stringify({ status: r.status, body: body.slice(0, 5000) }, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
  }

  if (debug === 'raw') {
    // 嘗試所有遊戲所有 endpoint，回傳 raw 結果方便排錯
    const out = { _months: months };
    for (const [key, cfg] of Object.entries(GAMES)) {
      out[key] = {};
      for (const ep of cfg.endpoints) {
        try {
          const r = await fetch(buildUrl(ep, months[0]), {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 GAME8LA/1.0' },
          });
          out[key][ep] = { status: r.status, body: r.status === 200 ? await r.json().catch(() => null) : null };
        } catch (e) {
          out[key][ep] = { error: String(e) };
        }
      }
    }
    return new Response(JSON.stringify(out, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // CDN cache for 10 minutes
  const cache = caches.default;
  const cacheKey = new Request('https://game8la.com/api/lottery/v7', request);
  let cached = await cache.match(cacheKey);
  if (cached) return cached;

  const keys = Object.keys(GAMES);
  const results = await Promise.all(keys.map(k => fetchGame(k, months)));
  const data = Object.fromEntries(keys.map((k, i) => [k, results[i]]));

  const body = JSON.stringify({
    updatedAt: new Date().toISOString(),
    data,
  });

  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
      'Access-Control-Allow-Origin': '*',
    },
  });

  await cache.put(cacheKey, response.clone());
  return response;
}

// ============================================================
// 娛樂城體檢「不出金」回報 — Cloudflare D1 全自動收件
// ============================================================
function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function normDomain(raw) {
  return String(raw || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0].split('?')[0].trim().toLowerCase();
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// 接收回報，寫入 D1
async function handleReport(request, env) {
  if (request.method !== 'POST') return jsonResp({ error: 'method' }, 405);
  if (!env.DB) return jsonResp({ error: 'no-db' }, 500);

  let d;
  try { d = await request.json(); } catch { return jsonResp({ error: 'bad-json' }, 400); }

  const url = String(d.url || '').trim().slice(0, 300);
  if (!url) return jsonResp({ error: 'url-required' }, 400);
  const domain = normDomain(d.domain || url).slice(0, 200);
  const amount = String(d.amount || '').slice(0, 20);
  const methods = String(d.methods || '').slice(0, 300);
  const note = String(d.note || '').slice(0, 1000);
  const ref = String(d.ref || '').slice(0, 50);

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ipHash = ip ? (await sha256Hex(ip + '|g8la-report-salt')).slice(0, 16) : '';

  // 輕量防洗版：同來源 + 同網域 10 分鐘內重複 → 靜默視為成功
  if (ipHash && domain) {
    const dup = await env.DB.prepare(
      'SELECT id FROM scam_reports WHERE ip_hash=?1 AND domain=?2 AND created_at > ?3 LIMIT 1'
    ).bind(ipHash, domain, new Date(Date.now() - 10 * 60 * 1000).toISOString()).first();
    if (dup) return jsonResp({ ok: true, dedup: true });
  }

  await env.DB.prepare(
    'INSERT INTO scam_reports (created_at, url, domain, amount, methods, note, ref, ip_hash) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)'
  ).bind(new Date().toISOString(), url, domain, amount, methods, note, ref, ipHash).run();

  return jsonResp({ ok: true });
}

// 後台改狀態（列管 / 不採用 / 待審）
async function handleReportStatus(request, env) {
  if (request.method !== 'POST') return jsonResp({ error: 'method' }, 405);
  let d;
  try { d = await request.json(); } catch { return jsonResp({ error: 'bad-json' }, 400); }
  if (!env.ADMIN_KEY || d.key !== env.ADMIN_KEY) return jsonResp({ error: 'forbidden' }, 403);
  const id = parseInt(d.id, 10);
  const status = ['待審', '已列管', '不採用'].includes(d.status) ? d.status : null;
  if (!id || !status) return jsonResp({ error: 'bad-args' }, 400);
  await env.DB.prepare('UPDATE scam_reports SET status=?1 WHERE id=?2').bind(status, id).run();
  return jsonResp({ ok: true });
}

// 秘密收件匣：/api/inbox?key=ADMIN_KEY
async function handleInbox(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return new Response('forbidden', { status: 403 });
  if (!env.DB) return new Response('no-db', { status: 500 });

  const { results: rows } = await env.DB.prepare(
    'SELECT id, created_at, url, domain, amount, methods, note, ref, status FROM scam_reports ORDER BY id DESC LIMIT 300'
  ).all();
  const { results: agg } = await env.DB.prepare(
    "SELECT domain, COUNT(*) n FROM scam_reports WHERE domain != '' GROUP BY domain HAVING n >= 2 ORDER BY n DESC, MAX(created_at) DESC LIMIT 40"
  ).all();

  const stat = (s) => ({ '待審': '#f5b800', '已列管': '#ef4444', '不採用': '#888' }[s] || '#888');
  const aggHtml = (agg || []).map((a) =>
    `<span class="chip" data-d="${escHtml(a.domain)}"><b>${a.n}</b>×&nbsp;${escHtml(a.domain)}</span>`
  ).join('') || '<i style="color:#888">尚無 2 次以上重複網域</i>';

  const rowsHtml = (rows || []).map((r) => `
    <tr data-id="${r.id}" data-domain="${escHtml(r.domain)}">
      <td class="mono">#${r.id}</td>
      <td class="mono small">${escHtml((r.created_at || '').replace('T', ' ').slice(0, 16))}</td>
      <td><div class="url">${escHtml(r.url)}</div><div class="dom mono small">${escHtml(r.domain)}</div></td>
      <td class="small">${escHtml(r.amount)}</td>
      <td class="small">${escHtml(r.methods)}</td>
      <td class="small note">${escHtml(r.note)}</td>
      <td><span class="st" style="background:${stat(r.status)}">${escHtml(r.status)}</span></td>
      <td class="act">
        <button onclick="setStatus(${r.id},'已列管')">列管</button>
        <button onclick="setStatus(${r.id},'不採用')" class="g">不採用</button>
        <button onclick="setStatus(${r.id},'待審')" class="g">待審</button>
      </td>
    </tr>`).join('');

  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>不出金回報 收件匣 — GAME8LA</title><style>
*{box-sizing:border-box}body{font-family:system-ui,"Noto Sans TC",sans-serif;background:#0d1117;color:#e6edf3;margin:0;padding:16px}
h1{font-size:1.2rem;margin:0 0 4px}.sub{color:#8b949e;font-size:.85rem;margin:0 0 16px}
.aggbox{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px;margin-bottom:16px}
.aggbox h2{font-size:.9rem;margin:0 0 8px;color:#f5b800}
.chip{display:inline-block;background:#21262d;border:1px solid #30363d;border-radius:20px;padding:3px 10px;margin:3px;font-size:.82rem}
.chip b{color:#ef4444}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th,td{border-bottom:1px solid #21262d;padding:7px 8px;text-align:left;vertical-align:top}
th{color:#8b949e;font-weight:600;position:sticky;top:0;background:#0d1117}
.mono{font-family:ui-monospace,monospace}.small{font-size:.78rem;color:#aeb7c0}
.url{word-break:break-all;max-width:260px}.dom{color:#58a6ff}.note{max-width:220px;white-space:pre-wrap}
.st{color:#000;font-weight:700;padding:2px 8px;border-radius:12px;font-size:.75rem;white-space:nowrap}
.act{white-space:nowrap}.act button{cursor:pointer;border:0;border-radius:6px;padding:4px 8px;margin:1px;font-size:.76rem;font-weight:700;background:#ef4444;color:#fff}
.act button.g{background:#30363d;color:#e6edf3}
.wrap{overflow-x:auto}
</style></head><body>
<h1>🍈 不出金回報 收件匣</h1>
<p class="sub">共 ${rows ? rows.length : 0} 筆（最新 300）。點「列管」會把該筆標記，之後可接自動風險分數。</p>
<div class="aggbox"><h2>⚠️ 重複網域（被 ≥2 人回報，自動查證的訊號）</h2>${aggHtml}</div>
<div class="wrap"><table>
<thead><tr><th>#</th><th>時間</th><th>網址/網域</th><th>金額</th><th>手法</th><th>補充</th><th>狀態</th><th>處理</th></tr></thead>
<tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#8b949e;padding:24px">尚無回報</td></tr>'}</tbody>
</table></div>
<script>
var KEY=${JSON.stringify(key)};
function setStatus(id,status){
  fetch('/api/report/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,status:status,key:KEY})})
    .then(function(r){return r.json()}).then(function(j){if(j.ok){location.reload()}else{alert('失敗：'+(j.error||'?'))}})
    .catch(function(e){alert('錯誤：'+e)});
}
</script></body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
}

// 公開：查某網域「已列管」的鄉民回報數（只回確認數，防止灌假回報黑競品）
async function handleReportCount(request, env) {
  const url = new URL(request.url);
  const domain = normDomain(url.searchParams.get('domain') || '');
  if (!domain || !env.DB) return jsonResp({ domain, count: 0 });
  let count = 0;
  try {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM scam_reports WHERE domain=?1 AND status='已列管'"
    ).bind(domain).first();
    count = (row && row.n) || 0;
  } catch (_) { count = 0; }
  return new Response(JSON.stringify({ domain, count }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    if (p === '/api/lottery') return handleLottery(request);
    if (p === '/api/report') return handleReport(request, env);
    if (p === '/api/report/status') return handleReportStatus(request, env);
    if (p === '/api/report-count') return handleReportCount(request, env);
    if (p === '/api/inbox') return handleInbox(request, env);
    return env.ASSETS.fetch(request);
  },
};
