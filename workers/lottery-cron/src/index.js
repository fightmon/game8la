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
// 彩種設定
// ============================================================
const LOTTERY_CONFIG = {
  daily_cash_539: {
    name: '今彩539',
    file: 'daily-cash-539.json',
    // 539 每天開
    drawDays: [0, 1, 2, 3, 4, 5, 6], // 0=Sun, 1=Mon...
    numberRange: { min: 1, max: 39, count: 5 },
    hasSpecial: false,
    // 台彩官網查詢頁面
    url: 'https://www.taiwanlottery.com.tw/Lotto/Dailycash/history.aspx',
    parseType: 'taiwanlottery',
  },
  super_lotto: {
    name: '威力彩',
    file: 'super-lotto.json',
    drawDays: [1, 4], // 週一、四
    numberRange: { min: 1, max: 38, count: 6 },
    specialRange: { min: 1, max: 8 },
    hasSpecial: true,
    url: 'https://www.taiwanlottery.com.tw/Lotto/SuperLotto638/history.aspx',
    parseType: 'taiwanlottery',
  },
  lotto649: {
    name: '大樂透',
    file: 'lotto649.json',
    drawDays: [2, 5], // 週二、五
    numberRange: { min: 1, max: 49, count: 6 },
    specialRange: { min: 1, max: 49 },
    hasSpecial: true,
    url: 'https://www.taiwanlottery.com.tw/Lotto/Lotto649/history.aspx',
    parseType: 'taiwanlottery',
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

    // GET /data/{filename} — 直接從 KV 讀取 JSON（給前端備用）
    if (url.pathname.startsWith('/data/')) {
      const file = url.pathname.replace('/data/', '');
      const data = await env.LOTTERY_KV.get(`json:${file}`, 'text');
      if (!data) return new Response('Not found', { status: 404 });
      return new Response(data, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
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
// 抓取開獎號碼
// ============================================================
async function fetchLatestDraw(cfg, todayStr) {
  // === 方法 1：從台灣彩券官網 HTML 解析 ===
  // 台彩官網是 ASP.NET，歷史頁需要 POST + ViewState
  // 這裡改用 Open Data 或第三方 JSON API（更穩定）

  // === 方法 2：透過較穩定的第三方 API ===
  // 你可以替換成任何可靠的資料源
  // 以下示範用 fetch + HTML parse 的備案邏輯

  try {
    // 嘗試從台彩官網的「最新開獎」區塊抓取
    // 官網首頁有當期號碼，不需要 POST
    const result = await fetchFromTWLottery(cfg, todayStr);
    if (result) return result;
  } catch (e) {
    console.log(`[fetchLatestDraw] 台彩官網失敗: ${e.message}`);
  }

  return null;
}

/**
 * 從台灣彩券官網抓取
 * 官網首頁 https://www.taiwanlottery.com.tw/ 有最新一期號碼
 * 各遊戲頁也有：
 *   539:    /Lotto/Dailycash/history.aspx
 *   威力彩: /Lotto/SuperLotto638/history.aspx
 *   大樂透: /Lotto/Lotto649/history.aspx
 */
async function fetchFromTWLottery(cfg, todayStr) {
  // 抓各彩種的 history 頁面（預設顯示最新一期）
  const resp = await fetch(cfg.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GAME8LA-Bot/1.0)',
    },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  const html = await resp.text();

  // --- 解析邏輯（根據台彩官網 HTML 結構）---
  // 台彩官網把號碼放在 <div class="ball_tx ball_green"> 等 tag 裡
  // 期別在 <span id="...Label_..."> 裡
  // 以下用正則式抓取，不依賴 DOM parser

  // 1. 抓期別
  const periodMatch = html.match(/第\s*<span[^>]*>(\d+)<\/span>\s*期/);
  if (!periodMatch) {
    // 備案：try another pattern
    const altPeriod = html.match(/期別[：:]?\s*(\d+)/);
    if (!altPeriod) throw new Error('找不到期別');
    // continue with altPeriod
  }
  const period = periodMatch ? periodMatch[1] : null;

  // 2. 抓號碼球
  // 台彩官網用 <div class="ball_tx ball_xxx">NN</div> 格式
  const ballRegex = /<div class="ball_tx[^"]*">\s*(\d+)\s*<\/div>/g;
  const balls = [];
  let bm;
  while ((bm = ballRegex.exec(html)) !== null) {
    balls.push(parseInt(bm[1], 10));
  }

  if (balls.length === 0) {
    throw new Error('找不到號碼球');
  }

  // 3. 分離主號碼和特別號
  let numbers, special;
  if (cfg.hasSpecial) {
    numbers = balls.slice(0, cfg.numberRange.count);
    special = balls[cfg.numberRange.count] || null;
  } else {
    numbers = balls.slice(0, cfg.numberRange.count);
    special = undefined;
  }

  // 驗證
  if (numbers.length !== cfg.numberRange.count) {
    throw new Error(`號碼數量不對：得到 ${numbers.length}，期望 ${cfg.numberRange.count}`);
  }

  const draw = {
    period: period,
    date: todayStr,
    numbers: numbers.sort((a, b) => a - b),
  };
  if (cfg.hasSpecial && special != null) {
    draw.special = special;
  }

  return draw;
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
