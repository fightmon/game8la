-- 預測遊戲：賽事 + 預測單
-- 套用：npx wrangler d1 execute game8la-db --remote --file=db/events.sql

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sport      TEXT NOT NULL DEFAULT 'worldcup',
  type       TEXT NOT NULL DEFAULT 'match',   -- match / outright
  title      TEXT NOT NULL UNIQUE,
  options    TEXT NOT NULL,                    -- JSON [{key,label,prob}]
  starts_at  TEXT NOT NULL,                    -- ISO，鎖單時間
  status     TEXT NOT NULL DEFAULT 'open',     -- open / settled
  result     TEXT,                             -- 正確選項 key
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status, starts_at);

CREATE TABLE IF NOT EXISTS predictions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id        INTEGER NOT NULL,
  event_id         INTEGER NOT NULL,
  choice           TEXT NOT NULL,
  stake            INTEGER NOT NULL,
  potential_payout INTEGER NOT NULL,           -- 押下去當下算好（含抽水）
  status           TEXT NOT NULL DEFAULT 'pending', -- pending / won / lost
  payout           INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(member_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_pred_member ON predictions(member_id);
CREATE INDEX IF NOT EXISTS idx_pred_event ON predictions(event_id);

-- 種子賽事（2026 世足開幕週；prob 為隱含勝率，加總≈1，抽水在 worker 計算）
INSERT OR IGNORE INTO events (title, options, starts_at) VALUES
('🇲🇽 墨西哥 vs 南非 🇿🇦', '[{"key":"home","label":"墨西哥贏","prob":0.58},{"key":"draw","label":"平手","prob":0.25},{"key":"away","label":"南非贏","prob":0.17}]', '2026-06-11T19:00:00Z'),
('🇦🇷 阿根廷 vs 沙烏地 🇸🇦', '[{"key":"home","label":"阿根廷贏","prob":0.72},{"key":"draw","label":"平手","prob":0.18},{"key":"away","label":"沙烏地贏","prob":0.10}]', '2026-06-12T11:00:00Z'),
('🇧🇷 巴西 vs 塞爾維亞 🇷🇸', '[{"key":"home","label":"巴西贏","prob":0.66},{"key":"draw","label":"平手","prob":0.22},{"key":"away","label":"塞爾維亞贏","prob":0.12}]', '2026-06-12T19:00:00Z'),
('🇪🇸 西班牙 vs 日本 🇯🇵', '[{"key":"home","label":"西班牙贏","prob":0.52},{"key":"draw","label":"平手","prob":0.26},{"key":"away","label":"日本贏","prob":0.22}]', '2026-06-13T11:00:00Z'),
('🇫🇷 法國 vs 美國 🇺🇸', '[{"key":"home","label":"法國贏","prob":0.55},{"key":"draw","label":"平手","prob":0.25},{"key":"away","label":"美國贏","prob":0.20}]', '2026-06-13T19:00:00Z'),
('🏆 2026 世足冠軍是誰？', '[{"key":"arg","label":"阿根廷","prob":0.16},{"key":"fra","label":"法國","prob":0.15},{"key":"bra","label":"巴西","prob":0.13},{"key":"esp","label":"西班牙","prob":0.12},{"key":"eng","label":"英格蘭","prob":0.10},{"key":"other","label":"其他隊","prob":0.34}]', '2026-06-12T03:00:00Z');
