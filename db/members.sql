-- 會員系統（Google 登入）+ 共用點數錢包
-- 套用：npx wrangler d1 execute game8la-db --remote --file=db/members.sql

CREATE TABLE IF NOT EXISTS members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub    TEXT UNIQUE NOT NULL,        -- Google 不變身分 ID
  email         TEXT,
  name          TEXT,                         -- Google 顯示名
  nickname      TEXT,                         -- 站內暱稱（可改，預設取 name）
  points        INTEGER NOT NULL DEFAULT 1000,-- 共用點數錢包（所有遊戲共用）
  last_refill_date TEXT,                       -- 上次每日補點日期（台北 YYYY-MM-DD）
  login_city    TEXT,                          -- 概略登入城市（CF geo）
  login_region  TEXT,
  login_country TEXT,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_members_points ON members(points DESC);

-- 點數流水（共用錢包；game 欄區分來源：prediction/mahjong/bigtwo/slot/baccarat/daily/signup）
CREATE TABLE IF NOT EXISTS point_ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id     INTEGER NOT NULL,
  delta         INTEGER NOT NULL,
  game          TEXT NOT NULL,
  reason        TEXT,
  balance_after INTEGER,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_member ON point_ledger(member_id, created_at);
