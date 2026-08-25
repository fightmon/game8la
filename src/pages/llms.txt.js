import { articles } from '../data/articles.js';

const SITE = 'https://game8la.com';

// 精選互動工具（網址鮮少變動，手動維護）
const TOOLS = [
  ['539 包牌計算器', '/tools/539-wheel-calculator/', '今彩 539 包牌組合數、成本、中獎機率一鍵試算'],
  ['大樂透包牌計算器', '/tools/lotto649-wheel-calculator/', '大樂透包牌幾個號碼多少錢、機率試算'],
  ['威力彩包牌計算器', '/tools/power-lottery-calculator/', '威力彩包牌成本與中獎機率試算'],
  ['老虎機模擬器（免費試玩）', '/tools/slot-simulator/', '免費試玩、看 RTP 真相，不花一毛錢'],
  ['雷神之鎚 II 模擬器', '/tools/thor-hammer-2-simulator/', '雷神之鎚 2 免費模擬試玩'],
  ['戰神呂布模擬器', '/tools/lu-bu-simulator/', '戰神呂布免費試玩，附賠付係數對照與購買免遊真實 RTP 揭露'],
  ['巴風特模擬器', '/tools/baphomet-simulator/', '巴風特免費模擬試玩'],
  ['21 點（Blackjack）', '/tools/blackjack/', '免費 21 點，用會員點數玩'],
  ['百家樂路紙工具', '/tools/baccarat-roadmap/', '大路、大眼、小路、曱甴路看牌'],
  ['RTP 追蹤器', '/tools/rtp-tracker/', '記錄你玩老虎機的實際 RTP'],
  ['麻將碰吃槓練習器', '/tools/mahjong-rules-trainer/', '什麼是碰、吃、槓，互動圖解'],
  ['麻將算台練習器', '/tools/mahjong-suan-tai-trainer/', '台灣 16 張算台練習'],
  ['麻將聽牌練習器', '/tools/mahjong-tenpai-trainer/', '聽牌牌型與等待張數練習'],
  ['台灣16張麻將練習桌', '/games/taiwan-mahjong/', '跟 3 個 AI 打完整一局台麻，教練即時建議打哪張、顯示向聽/進張/放槍風險，局後可逐手覆盤'],
  ['德州撲克規則互動教學', '/articles/texas-holdem-rules/', '用真的撲克牌互動圖解 10 種牌型、可逐步演示一局流程（底牌/翻牌/轉牌/河牌），附機率表與踢腳比大小實例'],
  ['21點算牌練習器', '/tools/blackjack-card-counting/', 'Hi-Lo 記牌訓練：牌一張張發、你記流水計數，系統算正確率並換算真數；並說明線上娛樂城 21 點為何算牌完全無效'],
  ['世足冠軍預測工具', '/tools/worldcup-2026/', '2026 世界盃冠軍勝率試算'],
  ['線上擲筊', '/tools/bless-blocks/', '聖筊陰筊笑筊 3D 動畫，問神明'],
  ['賭博自我檢測', '/tools/gambling-self-check/', '評估自己的賭博習慣是否健康'],
  ['統一發票對獎', '/tools/invoice-checker/', '快速對獎、不漏中獎號碼'],
];

// 主要專區
const SECTIONS = [
  ['世足 8LA 專區', '/worldcup/', '2026 世界盃賽果預測、戰績榜，用免費點數玩、零風險'],
  ['會員中心', '/member/', '天天免費領 1000 眼光點、每日簽到連續加碼'],
  ['賽果預測', '/predict/', '預測賽事結果、衝命中率與戰績'],
  ['芭樂攻略（文章總覽）', '/articles/', '彩券、娛樂城、老虎機、麻將、世足、反詐全攻略'],
  ['8LA 工具箱', '/tools/', '所有免費計算器、模擬器、練習器'],
  ['娛樂城評測排行', '/casino-ranking/', '芭樂子零業配、純評測的娛樂城體檢'],
  ['詐騙名單 / 娛樂城體檢', '/casino-check/', '查娛樂城是不是詐騙黑網，下注前先查'],
];

export function GET() {
  const out = [];
  out.push('# GAME8LA（芭樂子官網）');
  out.push('');
  out.push(
    '> 台灣博弈、彩券、線上遊戲的「誠實評測」站。主持人「芭樂子」（綠髮女孩、PTT 鄉民口吻）秉持反詐騙、純數學、零業配的原則：道具只能玩不能換現金、不導流賭場、不賣明牌。提供免費的彩券包牌計算器、老虎機模擬器、麻將練習器、世足預測等互動工具，以及大量白話攻略與反詐內容。'
  );
  out.push('');
  out.push('## 互動工具');
  for (const [name, url, desc] of TOOLS) {
    out.push(`- [${name}](${SITE}${url}): ${desc}`);
  }
  out.push('');
  out.push('## 主要專區');
  for (const [name, url, desc] of SECTIONS) {
    out.push(`- [${name}](${SITE}${url}): ${desc}`);
  }
  out.push('');
  out.push('## 攻略文章');
  for (const a of articles) {
    const desc = (a.excerpt || '').replace(/\s+/g, ' ').trim();
    out.push(`- [${a.title}](${SITE}/articles/${a.slug}/): ${desc}`);
  }
  out.push('');

  return new Response(out.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
