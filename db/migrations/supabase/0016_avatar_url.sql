-- =============================================================================
-- 0016_avatar_url.sql  ★Supabase 専用
-- LINEログイン時のプロフィール画像をアイコンに使うため、URL保存先を追加。
--   app_user.avatar_url … 先生のアイコン
--   patient.avatar_url  … 患者のアイコン（既存 avatar は絵文字。写真URLは別カラム）
-- =============================================================================

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE patient  ADD COLUMN IF NOT EXISTS avatar_url text;
