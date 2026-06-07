-- =============================================================================
-- 0013_appointment_location.sql  ★Supabase 専用
-- 予約に「施術場所(location)」を追加。場所テンプレは tenant_settings.settings.location_templates
-- （文字列配列）に保存するため、新規テーブルは不要。
-- =============================================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location text;
