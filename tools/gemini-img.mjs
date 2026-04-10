#!/usr/bin/env node
/**
 * GAME8LA Gemini 圖片生成工具
 *
 * 用法：
 *   # 單張生成
 *   node tools/gemini-img.mjs "芭樂子站在體育場中央" sports-hero.png
 *
 *   # 批次生成（讀取 JSON 佇列）
 *   node tools/gemini-img.mjs --batch tools/img-queue.json
 *
 * 環境變數：
 *   GEMINI_API_KEY  — Google AI Studio API key（必填）
 *
 * 批次 JSON 格式：
 *   [
 *     { "prompt": "描述文字", "output": "public/images/article-hero/xxx.png", "aspect": "16:9" },
 *     ...
 *   ]
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import https from 'https';

// ── Config ──
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'imagen-3.0-generate-002';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict?key=${API_KEY}`;

// 芭樂子的固定角色描述，所有 prompt 會自動加上這段前綴
const GUAVA_PREFIX = `Character "芭樂子 (Guava Girl)": a young anime-style girl with bright green hair, green guava-shaped hair ornaments, wearing a green high-tech mecha armor suit with "GAME8LA" logo, green LED headphones. Style: cyberpunk neon green glow, dark futuristic background, wide cinematic 16:9 composition, detailed anime illustration. `;

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) {
          reject(new Error(`API ${res.statusCode}: ${raw.slice(0, 500)}`));
        } else {
          resolve(JSON.parse(raw));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateImage(prompt, outputPath, aspect = '16:9') {
  const fullPrompt = GUAVA_PREFIX + prompt;
  console.log(`🎨 生成中: ${prompt.slice(0, 60)}...`);
  console.log(`   模型: ${MODEL} | 比例: ${aspect}`);

  const body = {
    instances: [{ prompt: fullPrompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: aspect,
      // safetyFilterLevel: 'BLOCK_ONLY_HIGH',  // 如果被安全過濾擋住可以取消註解
    },
  };

  const result = await httpPost(API_URL, body);

  // 取得 base64 圖片
  const predictions = result.predictions;
  if (!predictions || predictions.length === 0) {
    throw new Error('API 回傳空結果，可能被安全過濾擋住。試試調整 prompt。');
  }

  const imageBase64 = predictions[0].bytesBase64Encoded;
  if (!imageBase64) {
    throw new Error('回傳資料中沒有圖片，完整回應: ' + JSON.stringify(result).slice(0, 300));
  }

  // 確保目錄存在
  const dir = dirname(resolve(outputPath));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // 寫入檔案
  writeFileSync(resolve(outputPath), Buffer.from(imageBase64, 'base64'));
  console.log(`   ✅ 儲存: ${outputPath}`);
  return outputPath;
}

async function runBatch(queuePath) {
  if (!existsSync(queuePath)) {
    console.error(`❌ 找不到佇列檔案: ${queuePath}`);
    process.exit(1);
  }
  const queue = JSON.parse(readFileSync(queuePath, 'utf-8'));
  console.log(`📦 批次模式: ${queue.length} 張圖片\n`);

  const results = [];
  for (const item of queue) {
    try {
      await generateImage(item.prompt, item.output, item.aspect || '16:9');
      results.push({ ...item, status: 'ok' });
    } catch (err) {
      console.error(`   ❌ 失敗: ${err.message}`);
      results.push({ ...item, status: 'error', error: err.message });
    }
    // Gemini API rate limit: 小睡 2 秒避免被擋
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n📊 結果: ${results.filter(r => r.status === 'ok').length}/${results.length} 成功`);
  return results;
}

// ── Main ──
async function main() {
  if (!API_KEY) {
    console.error('❌ 請設定環境變數 GEMINI_API_KEY');
    console.error('   Windows PowerShell: $env:GEMINI_API_KEY="你的key"');
    console.error('   Mac/Linux: export GEMINI_API_KEY="你的key"');
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args[0] === '--batch' && args[1]) {
    await runBatch(args[1]);
  } else if (args.length >= 2) {
    const prompt = args[0];
    const output = args[1];
    const aspect = args[2] || '16:9';
    await generateImage(prompt, output, aspect);
  } else {
    console.log('用法:');
    console.log('  node tools/gemini-img.mjs "prompt 描述" output.png [16:9]');
    console.log('  node tools/gemini-img.mjs --batch tools/img-queue.json');
    console.log('');
    console.log('環境變數: GEMINI_API_KEY=你的Google AI Studio key');
  }
}

main().catch(err => {
  console.error('❌ 錯誤:', err.message);
  process.exit(1);
});
