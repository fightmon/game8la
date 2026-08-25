-- 麻將練習桌：加入底台輸贏（用眼光點當籌碼）
-- 套用：npx wrangler d1 execute game8la-db --remote --file=db/mahjong-stakes.sql
ALTER TABLE mahjong_stats ADD COLUMN net_points INTEGER NOT NULL DEFAULT 0;   -- 累計淨輸贏（點）
ALTER TABLE mahjong_stats ADD COLUMN deal_ins   INTEGER NOT NULL DEFAULT 0;   -- 放槍次數
ALTER TABLE mahjong_stats ADD COLUMN self_draws INTEGER NOT NULL DEFAULT 0;   -- 自摸次數
