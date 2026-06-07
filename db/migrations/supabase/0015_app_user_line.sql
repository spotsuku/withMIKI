-- =============================================================================
-- 0015_app_user_line.sql  ★Supabase 専用
-- 管理者（先生）も LINE ログインできるよう、app_user に LINE ユーザーIDを保持。
-- 連携は本人がログイン後に /settings から行う（サーバーは service role で更新）。
-- =============================================================================

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS line_user_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_line ON app_user(line_user_id) WHERE line_user_id IS NOT NULL;
