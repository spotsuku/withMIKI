-- =============================================================================
-- 0017_user_google_token.sql  ★Supabase 専用
-- Googleカレンダー連携を「ユーザー単位（先生ごと）」にする。
-- これまで tenant_settings に院単位で1つだったため、誰か1人連携すると全員が
-- 連携済み扱いになっていた。app_user ごとにトークンを持たせて個別連携にする。
-- =============================================================================

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS google_token jsonb;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS google_calendar_id text;
