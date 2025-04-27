-- 创建配置表
CREATE TABLE IF NOT EXISTS config (name TEXT PRIMARY KEY, value TEXT NOT NULL);

-- 创建API密钥表
CREATE TABLE IF NOT EXISTS keys (
  key TEXT PRIMARY KEY,
  balance REAL DEFAULT 0,
  added TEXT NOT NULL,
  last_updated TEXT
);

-- 插入默认配置
INSERT INTO
  config (name, value)
VALUES
  ('admin_username', 'admin'),
  ('admin_password', '123456'),
  ('api_key', 'sk'),
  ('page_size', '12'),
  ('access_control', 'open'),
  ('guest_password', '123456');
