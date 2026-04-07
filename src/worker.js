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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/lottery' || url.pathname === '/api/lottery/') {
      return handleLottery(request);
    }
    return env.ASSETS.fetch(request);
  },
};
