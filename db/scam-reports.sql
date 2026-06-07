-- 娛樂城體檢「不出金」鄉民回報資料表
-- 套用：npx wrangler d1 execute game8la-db --remote --file=db/scam-reports.sql
CREATE TABLE IF NOT EXISTS scam_reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,            -- ISO 時間（UTC）
  url        TEXT NOT NULL,            -- 使用者輸入的原始網址 / 名稱
  domain     TEXT,                     -- 正規化後的網域（小寫、去 https/www/path）
  amount     TEXT,                     -- 卡關金額區間
  methods    TEXT,                     -- 遇到的手法（、分隔）
  note       TEXT,                     -- 補充說明
  ref        TEXT,                     -- 來源頁
  ip_hash    TEXT,                     -- 去識別的來源指紋（防洗版用，非明碼 IP）
  status     TEXT NOT NULL DEFAULT '待審'  -- 待審 / 已列管 / 不採用
);
CREATE INDEX IF NOT EXISTS idx_reports_domain  ON scam_reports(domain);
CREATE INDEX IF NOT EXISTS idx_reports_created ON scam_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_status  ON scam_reports(status);
