-- =============================================================================
-- 0004_supabase_auth_rls.sql  ★Supabase 専用（auth スキーマが必要）
--
-- コアの 0001-0003 は「API が SET app.tenant_id を行う」GUC 方式（自前API向け）。
-- Supabase はクライアントから PostgREST 経由で接続するため、テナントを
-- ログインユーザー auth.uid() から解決する必要がある。本 migration で:
--   1. app_user に auth_user_id（auth.users 参照）を追加
--   2. app_current_tenant() … GUC があればそれ、無ければ auth.uid() から解決
--   3. tenant_isolation_* / parent_isolation_* を app_current_tenant() ベースへ置換
--
-- 適用順: 0001 → 0002 → 0003 → 0004（Supabase の SQL Editor / psql で実行）
-- 詳細: docs/setup/supabase-setup.md §3
-- =============================================================================

-- 1) Auth ユーザーとのひも付け
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_app_user_auth ON app_user(auth_user_id);

-- 2) 現在のテナント解決関数
--    - GUC(app.tenant_id) が設定されていれば優先（自前API/バッチ互換）
--    - 無ければログインユーザー(auth.uid())の所属テナント
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    (SELECT u.tenant_id FROM app_user u WHERE u.auth_user_id = auth.uid() LIMIT 1)
  );
$$;

-- 3) ポリシーを app_current_tenant() ベースへ置換
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patient','app_user','care_program','patient_program','patient_intake','karte_cover',
    'problem','visit','soap_note','body_diagram','daily_record','medication',
    'training_session','nutrition_goal','attachment','food_entry','lab_result',
    'media','observation_definition','observation','line_account',
    'import_job','ai_job','consent','audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%1$s ON %1$s;', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation_%1$s ON %1$s
      USING (tenant_id = app_current_tenant())
      WITH CHECK (tenant_id = app_current_tenant());
    $p$, t);
  END LOOP;
END $$;

-- 子テーブル（親経由）
DROP POLICY IF EXISTS parent_isolation_gyneco_daily ON gyneco_daily;
DROP POLICY IF EXISTS parent_isolation_athlete_daily ON athlete_daily;
DROP POLICY IF EXISTS parent_isolation_selfcare_log ON selfcare_log;
DROP POLICY IF EXISTS parent_isolation_medication_log ON medication_log;
DROP POLICY IF EXISTS parent_isolation_visit_vital ON visit_vital;
DROP POLICY IF EXISTS parent_isolation_lab_value ON lab_value;

CREATE POLICY parent_isolation_gyneco_daily ON gyneco_daily USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = gyneco_daily.daily_record_id AND d.tenant_id = app_current_tenant()));
CREATE POLICY parent_isolation_athlete_daily ON athlete_daily USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = athlete_daily.daily_record_id AND d.tenant_id = app_current_tenant()));
CREATE POLICY parent_isolation_selfcare_log ON selfcare_log USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = selfcare_log.daily_record_id AND d.tenant_id = app_current_tenant()));
CREATE POLICY parent_isolation_medication_log ON medication_log USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = medication_log.daily_record_id AND d.tenant_id = app_current_tenant()));
CREATE POLICY parent_isolation_visit_vital ON visit_vital USING (
  EXISTS (SELECT 1 FROM visit v
          WHERE v.id = visit_vital.visit_id AND v.tenant_id = app_current_tenant()));
CREATE POLICY parent_isolation_lab_value ON lab_value USING (
  EXISTS (SELECT 1 FROM lab_result r
          WHERE r.id = lab_value.lab_result_id AND r.tenant_id = app_current_tenant()));

-- authenticated ロールに必要権限を付与（PostgREST 経由のアクセス用）
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
