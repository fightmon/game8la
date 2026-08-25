-- 麻將練習桌：會員成績（訪客可玩，登入才記錄／上榜）
-- 套用：npx wrangler d1 execute game8la-db --remote --file=db/mahjong-stats.sql
CREATE TABLE IF NOT EXISTS mahjong_stats (
  member_id    INTEGER PRIMARY KEY,
  games        INTEGER NOT NULL DEFAULT 0,   -- 完成局數
  wins         INTEGER NOT NULL DEFAULT 0,   -- 胡牌次數
  best_tai     INTEGER NOT NULL DEFAULT 0,   -- 單局最大台
  coach_match  INTEGER NOT NULL DEFAULT 0,   -- 與教練建議一致的出手數
  coach_total  INTEGER NOT NULL DEFAULT 0,   -- 總出手數
  updated_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mj_games ON mahjong_stats(games);
