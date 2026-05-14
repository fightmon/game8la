/**
 * GAME8LA 彩券開獎 Cron Worker
 * ============================
 * 每天 21:35 (UTC+8) 自動抓取台灣彩券開獎號碼
 * 寫入 Cloudflare KV → 同時更新 GitHub repo 的 JSON → 觸發 Pages 重新部署
 *
 * 開獎時間：
 *   539     — 每天 ~21:00
 *   威力彩  — 週一、四 ~20:45
 *   大樂透  — 週二、五 ~20:45
 */

// ============================================================
// 台灣彩券官方 JSON API（和 worker.js 相同來源）
// ============================================================
const LOTTERY_API_BASE = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery';

// ============================================================
// 彩種設定
// ============================================================
const LOTTERY_CONFIG = {
  daily_cash_539: {
    name: '今彩539',
    file: 'daily-cash-539.json',
    drawDays: [1, 2, 3, 4, 5, 6], // 週一至六（週日不開）
    numberRange: { min: 1, max: 39, count: 5 },
    hasSpecial: false,
    // 官方 API endpoint（多個 fallback）
    apiEndpoints: ['Daily539Result', 'DailyCash539Result', 'DailyCashResult', 'Cash539Result'],
    apiArrayKeys: ['daily539Res', 'dailyCash539Res', 'dailyCashRes', 'cash539Res'],
    parseRecord(rec) {
      const all = rec.drawNumberSize || rec.drawNumberAppear || [];
      return {
        period: rec.period != null ? String(rec.period) : null,
        date: (rec.lotteryDate || '').slice(0, 10),
        numbers: all.slice(0, 5).slice().sort((a, b) => a - b),
      };
    },
  },
  super_lotto: {
    name: '威力彩',
    file: 'super-lotto.json',
    drawDays: [1, 4], // 週一、四
    numberRange: { min: 1, max: 38, count: 6 },
    specialRange: { min: 1, max: 8 },
    hasSpecial: true,
    apiEndpoints: ['SuperLotto638Result'],
    apiArrayKeys: ['superLotto638Res'],
    parseRecord(rec) {
      const all = rec.drawNumberSize || [];
      return {
        period: rec.period != null ? String(rec.period) : null,
        date: (rec.lotteryDate || '').slice(0, 10),
        numbers: all.slice(0, 6).slice().sort((a, b) => a - b),
        special: all[6] != null ? Number(all[6]) : null,
      };
    },
  },
  lotto649: {
    name: '大樂透',
    file: 'lotto649.json',
    drawDays: [2, 5], // 週二、五
    numberRange: { min: 1, max: 49, count: 6 },
    specialRange: { min: 1, max: 49 },
    hasSpecial: true,
    apiEndpoints: ['Lotto649Result'],
    apiArrayKeys: ['lotto649Res'],
    parseRecord(rec) {
      const all = rec.drawNumberSize || [];
      return {
        period: rec.period != null ? String(rec.period) : null,
        date: (rec.lotteryDate || '').slice(0, 10),
        numbers: all.slice(0, 6).slice().sort((a, b) => a - b),
        special: all[6] != null ? Number(all[6]) : null,
      };
    },
  },
};

// ============================================================
// 主入口
// ============================================================
export default {
  // Cron 觸發
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },

  // HTTP 觸發（手動測試用：GET /run 強制執行）
  async fetch(request, env) {
    const url = new URL(request.url);

    // GET /run?key=YOUR_SECRET — 手動觸發
    if (url.pathname === '/run') {
      // 簡單防護：用 query param 當密鑰
      if (url.searchParams.get('key') !== env.CRON_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      await handleCron(env);
      return new Response('OK — cron executed manually', { status: 200 });
    }

    // GET /data/{filename} — 直接從 KV 讀取 JSON（給前端即時讀取）
    if (url.pathname.startsWith('/data/')) {
      const file = url.pathname.replace('/data/', '');
      let data = await env.LOTTERY_KV.get(`json:${file}`, 'text');

      // Auto-seed：KV 沒資料時，從正式站靜態 JSON 拉一份進來
      if (!data) {
        try {
          const seedRes = await fetch(`https://game8la.com/data/${file}`);
          if (seedRes.ok) {
            data = await seedRes.text();
            await env.LOTTERY_KV.put(`json:${file}`, data);
            console.log(`[auto-seed] ${file} 已從靜態站匯入 KV`);
          }
        } catch (e) {
          console.warn(`[auto-seed] ${file} 失敗: ${e.message}`);
        }
      }

      if (!data) return new Response('Not found', { status: 404 });

      // CORS：允許正式站 + localhost 開發
      const origin = request.headers.get('Origin') || '';
      const allowedOrigins = ['https://game8la.com', 'http://localhost:4321', 'http://localhost:3000'];
      const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://game8la.com';

      return new Response(data, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    return new Response('GAME8LA Lottery Cron Worker', { status: 200 });
  },
};

// ============================================================
// 核心邏輯
// ============================================================
async function handleCron(env) {
  const now = new Date();
  // UTC+8
  const twNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const dayOfWeek = twNow.getUTCDay(); // 0=Sun
  const todayStr = formatDate(twNow);

  console.log(`[lottery-cron] ${todayStr} (星期${dayOfWeek}) 開始執行`);

  let updated = false;

  for (const [key, cfg] of Object.entries(LOTTERY_CONFIG)) {
    // 只處理今天有開獎的彩種
    if (!cfg.drawDays.includes(dayOfWeek)) {
      console.log(`[${cfg.name}] 今天沒開獎，跳過`);
      continue;
    }

    try {
      console.log(`[${cfg.name}] 開始抓取...`);
      const newDraw = await fetchLatestDraw(cfg, todayStr);

      if (!newDraw) {
        console.log(`[${cfg.name}] 無法取得最新開獎或尚未開獎`);
        continue;
      }

      // 從 KV 讀取現有資料
      const existing = await getExistingData(env, key, cfg);

      // 檢查是否已存在（避免重複）
      if (existing.draws.some(d => d.period === newDraw.period)) {
        console.log(`[${cfg.name}] 第 ${newDraw.period} 期已存在，跳過`);
        continue;
      }

      // 插入新開獎到最前面
      existing.draws.unshift(newDraw);
      // 只保留最近 200 期
      if (existing.draws.length > 200) {
        existing.draws = existing.draws.slice(0, 200);
      }
      existing.lastUpdated = todayStr;

      // 寫回 KV
      await env.LOTTERY_KV.put(`json:${cfg.file}`, JSON.stringify(existing, null, 2));
      console.log(`[${cfg.name}] 第 ${newDraw.period} 期已寫入 KV`);
      updated = true;
    } catch (err) {
      console.error(`[${cfg.name}] 錯誤：${err.message}`);
    }
  }

  // 如果有更新，觸發 Pages 重新部署
  if (updated) {
    await triggerPagesDeploy(env);
  }
}

// ============================================================
// 抓取開獎號碼（使用官方 JSON API）
// ============================================================

/** 取得台北時區的當月 YYYY-MM，可往前偏移 */
function taipeiMonth(offset = 0) {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  now.setUTCMonth(now.getUTCMonth() + offset);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** 從 API JSON 中提取開獎紀錄陣列 */
function extractRecords(json, arrayKeys) {
  const content = json?.content;
  if (!content) return [];
  for (const k of arrayKeys) {
    if (Array.isArray(content[k]) && content[k].length > 0) {
      return content[k];
    }
  }
  return [];
}

async function fetchLatestDraw(cfg, todayStr) {
  // 嘗試當月和上月（月初可能 API 只有上月資料）
  const months = [taipeiMonth(0), taipeiMonth(-1)];

  for (const month of months) {
    for (const ep of cfg.apiEndpoints) {
      try {
        const url = `${LOTTERY_API_BASE}/${ep}?period=&month=${month}&pageNum=1&pageSize=5`;
        console.log(`[fetchLatestDraw] 嘗試 ${ep} month=${month}`);

        const resp = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 GAME8LA/1.0',
          },
        });

        if (!resp.ok) {
          console.log(`[fetchLatestDraw] ${ep} HTTP ${resp.status}`);
          continue;
        }

        const json = await resp.json();
        const records = extractRecords(json, cfg.apiArrayKeys);

        if (records.length === 0) {
          console.log(`[fetchLatestDraw] ${ep} 無開獎紀錄`);
          continue;
        }

        // 取最新一筆
        const latest = records[0];
        const parsed = cfg.parseRecord(latest);

        if (!parsed.numbers || parsed.numbers.length === 0) {
          console.log(`[fetchLatestDraw] ${ep} 號碼解析為空`);
          continue;
        }

        console.log(`[fetchLatestDraw] 成功取得 ${cfg.name} 第 ${parsed.period} 期`);
        return parsed;
      } catch (e) {
        console.log(`[fetchLatestDraw] ${ep} 失敗: ${e.message}`);
      }
    }
  }

  return null;
}

// ============================================================
// 讀取 / 初始化 KV 資料
// ============================================================
async function getExistingData(env, key, cfg) {
  const raw = await env.LOTTERY_KV.get(`json:${cfg.file}`, 'text');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }

  // 初始化結構
  const base = {
    lottery: key,
    description: cfg.name,
    numberRange: cfg.numberRange,
    hasSpecial: cfg.hasSpecial,
    lastUpdated: '',
    draws: [],
  };
  if (cfg.specialRange) {
    base.specialRange = cfg.specialRange;
  }
  return base;
}

// ============================================================
// 觸發 Cloudflare Pages 重新部署
// ============================================================
async function triggerPagesDeploy(env) {
  // 方法：用 Cloudflare API 建立一個新的 deployment
  // 需要 CF_API_TOKEN + CF_ACCOUNT_ID
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    console.log('[deploy] 缺少 CF_API_TOKEN 或 CF_ACCOUNT_ID，跳過部署觸發');
    return;
  }

  try {
    // 用 deploy hook 更簡單（見 README）
    // 如果你在 Pages 設定了 Deploy Hook URL：
    if (env.CF_DEPLOY_HOOK_URL) {
      const resp = await fetch(env.CF_DEPLOY_HOOK_URL, { method: 'POST' });
      console.log(`[deploy] Deploy hook 回應: ${resp.status}`);
      return;
    }

    // 或用 API 重新觸發最新 commit 的部署
    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/pages/projects/${env.CF_PAGES_PROJECT}/deployments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = await resp.json();
    if (data.success) {
      console.log(`[deploy] Pages 部署已觸發: ${data.result?.id}`);
    } else {
      console.log(`[deploy] 部署失敗: ${JSON.stringify(data.errors)}`);
    }
  } catch (err) {
    console.error(`[deploy] 觸發部署錯誤: ${err.message}`);
  }
}

// ============================================================
// 工具函式
// ============================================================
function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
