/**
 * Game8la Telegram Bot — Cloudflare Worker
 *
 * 功能：
 * 1. 新成員歡迎訊息
 * 2. 每日定時推薦彩號（cron 09:00 台灣時間）
 * 3. 關鍵字自動回覆
 * 4. 新文章推播（POST /push-article）
 */

// ===== 關鍵字回覆對照表 =====
const KEYWORD_REPLIES = [
  {
    keywords: ['rtp', 'RTP', 'rtp是什麼', '返還率', '回報率'],
    reply: '🎰 RTP（Return to Player）是老虎機的長期返還率\n\n' +
           '👉 完整科普：https://game8la.com/articles/rtp-explained/\n' +
           '👉 RTP 實測紀錄器：https://game8la.com/tools/rtp-tracker/'
  },
  {
    keywords: ['詐騙', '黑網', '被騙', '出金', '不能提款', '詐欺'],
    reply: '⚠️ 懷疑遇到詐騙？先冷靜！\n\n' +
           '👉 5招識破詐騙：https://game8la.com/articles/5-tips-spot-casino-scam/\n' +
           '👉 娛樂城體檢工具：https://game8la.com/casino-check/\n' +
           '👉 165 詐騙通報週報：https://game8la.com/articles/165-weekly-report-w17/\n\n' +
           '📞 如已受害請撥 165 反詐騙專線'
  },
  {
    keywords: ['戰神賽特', 'seth', '賽特'],
    reply: '⚡ 戰神賽特2：覺醒之力\n' +
           'ATG電子 ｜ RTP 96.89% ｜ 最大 x81,000\n\n' +
           '👉 完整評測：https://game8la.com/games/seth-2/\n' +
           '👉 RNG真相拆解：https://game8la.com/articles/seth-rng-myth-busted/'
  },
  {
    keywords: ['雷神', 'thor', '之錘', '之鎚'],
    reply: '🔨 雷神之錘II\n' +
           'RSG電子 ｜ GLI認證 ｜ 最大 x25,000\n\n' +
           '👉 完整評測：https://game8la.com/games/thor-hammer-2/\n' +
           '👉 雷神模擬器：https://game8la.com/tools/thor-hammer-2-simulator/'
  },
  {
    keywords: ['麻將', 'mahjong', '胡了'],
    reply: '🀄 麻將胡了2\n' +
           'PG Soft ｜ 2000路 ｜ 最大 x100,000\n\n' +
           '👉 完整評測：https://game8la.com/games/mahjong-ways-2/'
  },
  {
    keywords: ['魔龍', 'dragon', '傳奇'],
    reply: '🐉 魔龍傳奇\n' +
           'GR電子 ｜ 經典IP ｜ RTP 96.35%\n\n' +
           '👉 完整評測：https://game8la.com/games/dragon-legend/'
  },
  {
    keywords: ['糖果', 'candy', '爆爆樂'],
    reply: '🍬 糖果爆爆樂\n' +
           'PG Soft ｜ 6×6消除 ｜ 最高 15,000x\n\n' +
           '👉 完整評測：https://game8la.com/games/candy-burst/'
  },
  {
    keywords: ['呂布', 'lubu', '戰神呂布'],
    reply: '⚔️ 戰神呂布\n' +
           'RSG電子 ｜ 三國志 ｜ 最高 51,000x\n\n' +
           '👉 完整評測：https://game8la.com/games/god-of-war-lubu/'
  },
  {
    keywords: ['包牌', '539', '彩券', '樂透', '威力彩', '大樂透'],
    reply: '🎱 芭樂冷數據專區\n\n' +
           '👉 號碼分析工具：https://game8la.com/lottery/analysis/\n' +
           '👉 539包牌攻略：https://game8la.com/articles/daily-cash-539-wheel-strategy/\n' +
           '👉 威力彩機率拆解：https://game8la.com/articles/super-lotto-odds-explained/'
  },
  {
    keywords: ['模擬', '試玩', '轉轉機', 'simulator'],
    reply: '🎮 Game8la 免費模擬器\n\n' +
           '👉 芭樂轉轉機：https://game8la.com/tools/slot-simulator/\n' +
           '👉 雷神模擬器：https://game8la.com/tools/thor-hammer-2-simulator/\n' +
           '👉 百家樂 EV 模擬：https://game8la.com/tools/baccarat-simulator/'
  },
  {
    keywords: ['工具', 'tool', '計算器', '資金管理'],
    reply: '🧰 8LA 工具箱\n\n' +
           '👉 RTP 紀錄器：https://game8la.com/tools/rtp-tracker/\n' +
           '👉 資金管理計算器：https://game8la.com/tools/bankroll-calculator/\n' +
           '👉 全部工具：https://game8la.com/tools/'
  },
  {
    keywords: ['現金版', '信用版'],
    reply: '💰 現金版 vs 信用版差在哪？\n\n' +
           '👉 完整比較：https://game8la.com/articles/casino-payout-guide/'
  },
  {
    keywords: ['違法', '合法', '法律'],
    reply: '⚖️ 台灣玩娛樂城到底違不違法？\n\n' +
           '👉 法律科普：https://game8la.com/articles/online-gambling-law-taiwan/'
  },
  {
    keywords: ['排名', '排行', '推薦', '哪個好玩'],
    reply: '🏆 2026 老虎機評分總排名\n\n' +
           '👉 完整排名：https://game8la.com/game-ranking/'
  },
  {
    keywords: ['擲筊', '拜拜', '求籤'],
    reply: '🌿 芭樂子擲筊工具\n\n' +
           '👉 來擲一筊：https://game8la.com/tools/bless-blocks/'
  },
];

// ===== Telegram API Helper =====
async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ===== 1. 歡迎新成員 =====
async function handleNewMembers(token, chatId, members) {
  const names = members.map(m => m.first_name || m.username || '新朋友').join('、');
  const text =
    `🎮 歡迎 ${names} 加入 Game8la 討論群！\n\n` +
    `這裡是台灣玩家的真實交流空間：\n` +
    `• 老虎機實測數據 & 攻略\n` +
    `• 詐騙預警 & 娛樂城評測\n` +
    `• 彩券數據分析\n\n` +
    `📌 輸入遊戲名稱（如「賽特」「麻將」），芭樂子會自動回覆評測連結\n` +
    `📌 輸入「詐騙」可查詢防詐資源\n\n` +
    `🌐 官網：https://game8la.com`;

  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

// ===== 2. 關鍵字自動回覆 =====
async function handleKeywordReply(token, chatId, messageText, messageId) {
  const lower = messageText.toLowerCase();

  for (const rule of KEYWORD_REPLIES) {
    const matched = rule.keywords.some(kw => lower.includes(kw.toLowerCase()));
    if (matched) {
      await tg(token, 'sendMessage', {
        chat_id: chatId,
        text: rule.reply,
        reply_to_message_id: messageId,
        disable_web_page_preview: true,
      });
      return true;
    }
  }
  return false;
}

// ===== 3. 每日推薦彩號 =====
async function sendDailyLottery(token, chatId, lotteryApi) {
  try {
    const res = await fetch(`${lotteryApi}/daily-cash-539.json`);
    const data = await res.json();

    // 取最近一期
    const latest = data.draws?.[0];
    if (!latest) return;

    // 簡易冷熱分析（近 50 期）
    const recent50 = data.draws.slice(0, 50);
    const freq = {};
    for (let i = 1; i <= 39; i++) freq[i] = 0;
    recent50.forEach(d => d.numbers.forEach(n => freq[n]++));

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const hot5 = sorted.slice(0, 5).map(e => e[0]).join(', ');
    const cold5 = sorted.slice(-5).map(e => e[0]).join(', ');

    // 芭樂推薦號（冷熱加權隨機）
    const pool = Object.entries(freq);
    const weighted = pool.map(([num, f]) => ({
      num: parseInt(num),
      weight: f <= 3 ? 3 : f >= 10 ? 2 : 1, // 冷號權重高
    }));
    const picks = [];
    const available = [...weighted];
    for (let i = 0; i < 5; i++) {
      const totalW = available.reduce((s, w) => s + w.weight, 0);
      let r = Math.random() * totalW;
      for (let j = 0; j < available.length; j++) {
        r -= available[j].weight;
        if (r <= 0) {
          picks.push(available[j].num);
          available.splice(j, 1);
          break;
        }
      }
    }
    picks.sort((a, b) => a - b);

    const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });

    const text =
      `🎱 今日推薦彩號（${today}）\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `🔥 近50期熱號：${hot5}\n` +
      `❄️ 近50期冷號：${cold5}\n\n` +
      `🌿 芭樂子推薦：${picks.join(', ')}\n\n` +
      `📊 上期開獎（${latest.date}）：${latest.numbers.join(', ')}\n\n` +
      `👉 完整分析：https://game8la.com/lottery/analysis/\n\n` +
      `⚠️ 純屬數據參考，請理性投注`;

    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error('Daily lottery error:', err);
  }
}

// ===== 4. 新文章推播 =====
async function pushArticle(token, chatId, article) {
  const { title, url, desc, category } = article;

  const categoryEmoji = {
    slots: '🎰',
    lottery: '🎱',
    scam: '⚠️',
    guide: '📚',
    tool: '🧰',
    review: '🏆',
  };
  const emoji = categoryEmoji[category] || '📢';

  const text =
    `${emoji} 新文章上線！\n\n` +
    `📝 ${title}\n\n` +
    `${desc || ''}\n\n` +
    `👉 立即閱讀：${url}\n\n` +
    `💬 看完來群裡討論吧！`;

  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: false, // 讓 TG 抓 og:image 預覽
  });
}

// ===== /chatid 指令（用來取得群組 Chat ID） =====
async function handleChatIdCommand(token, chatId) {
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: `📋 此聊天的 Chat ID：\n\`${chatId}\`\n\n請將此 ID 填入 wrangler.toml 的 TG_CHAT_ID`,
    parse_mode: 'Markdown',
  });
}

// ===== /help 指令 =====
async function handleHelpCommand(token, chatId) {
  const text =
    `🌿 Game8la 芭樂子 Bot 指令\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `📌 直接輸入遊戲名稱，我會回覆評測連結\n` +
    `　例：賽特、麻將、雷神、魔龍\n\n` +
    `📌 輸入關鍵字，我會回覆相關資源\n` +
    `　例：RTP、詐騙、包牌、模擬、工具\n\n` +
    `📌 指令列表：\n` +
    `　/help — 顯示此說明\n` +
    `　/ranking — 遊戲排名\n` +
    `　/tools — 工具箱\n` +
    `　/lottery — 彩券分析\n\n` +
    `🌐 官網：https://game8la.com`;

  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

// ===== 快捷指令 =====
const QUICK_COMMANDS = {
  '/ranking': '🏆 2026 老虎機評分總排名\n\n👉 https://game8la.com/game-ranking/',
  '/tools': '🧰 8LA 工具箱\n\n👉 https://game8la.com/tools/',
  '/lottery': '🎱 芭樂冷數據專區\n\n👉 https://game8la.com/lottery/analysis/',
  '/scam': '⚠️ 娛樂城體檢工具\n\n👉 https://game8la.com/casino-check/',
};

// ===== 主處理邏輯 =====
export default {
  // Webhook handler（收到 TG 訊息時）
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = env.TG_BOT_TOKEN;
    const chatId = env.TG_CHAT_ID;

    // POST /webhook — Telegram Webhook
    if (request.method === 'POST' && url.pathname === '/webhook') {
      try {
        const update = await request.json();

        // 新成員加入
        if (update.message?.new_chat_members?.length > 0) {
          await handleNewMembers(
            token,
            update.message.chat.id,
            update.message.new_chat_members
          );
          return new Response('OK');
        }

        // 文字訊息
        if (update.message?.text) {
          const text = update.message.text.trim();
          const msgChatId = update.message.chat.id;
          const msgId = update.message.message_id;

          // /chatid 指令
          if (text === '/chatid') {
            await handleChatIdCommand(token, msgChatId);
            return new Response('OK');
          }

          // /help 指令
          if (text === '/help' || text === '/start') {
            await handleHelpCommand(token, msgChatId);
            return new Response('OK');
          }

          // 快捷指令
          const cmd = text.split('@')[0]; // 處理 /ranking@Game8laBot 格式
          if (QUICK_COMMANDS[cmd]) {
            await tg(token, 'sendMessage', {
              chat_id: msgChatId,
              text: QUICK_COMMANDS[cmd],
              disable_web_page_preview: true,
            });
            return new Response('OK');
          }

          // 關鍵字回覆
          await handleKeywordReply(token, msgChatId, text, msgId);
        }

        return new Response('OK');
      } catch (err) {
        console.error('Webhook error:', err);
        return new Response('Error', { status: 500 });
      }
    }

    // POST /push-article — 手動推播新文章
    if (request.method === 'POST' && url.pathname === '/push-article') {
      // 簡易驗證（用 Bearer token）
      const auth = request.headers.get('Authorization');
      if (auth !== `Bearer ${token}`) {
        return new Response('Unauthorized', { status: 401 });
      }

      try {
        const article = await request.json();
        await pushArticle(token, chatId, article);
        return Response.json({ ok: true, message: 'Article pushed' });
      } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    // GET /setup-webhook — 設定 Telegram Webhook（部署後呼叫一次）
    if (url.pathname === '/setup-webhook') {
      const webhookUrl = `${url.origin}/webhook`;
      const result = await tg(token, 'setWebhook', { url: webhookUrl });
      return Response.json(result);
    }

    // GET / — 健康檢查
    return Response.json({
      bot: 'Game8la TG Bot',
      status: 'running',
      endpoints: [
        'POST /webhook — Telegram webhook',
        'POST /push-article — Push new article',
        'GET /setup-webhook — Register webhook',
      ],
    });
  },

  // Cron handler（每日定時推薦彩號）
  async scheduled(event, env) {
    const token = env.TG_BOT_TOKEN;
    const chatId = env.TG_CHAT_ID;
    const lotteryApi = env.LOTTERY_API;

    if (chatId) {
      await sendDailyLottery(token, chatId, lotteryApi);
    }
  },
};
