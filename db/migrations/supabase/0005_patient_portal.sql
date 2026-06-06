-- =============================================================================
-- 0005_patient_portal.sql  ★Supabase 専用（auth スキーマが必要）
--
-- 患者本人がデイリー記録を入力できるようにする「患者ポータル」用の基盤。
--   1. patient_user … Auth ユーザー(auth.uid()) と patient をひも付け
--   2. app_current_patient() … ログイン中の患者 ID を返す
--   3. 患者本人が「自分の行だけ」を読み書きできる permissive ポリシーを追加
--      （既存の tenant_isolation_* と OR で合成される）
--
-- 適用順: 0001 → 0002 → 0003 → 0004 → 0005
-- 患者は Supabase Auth でログインし、patient_user で patient にひも付ける。
-- 将来 LINE ログイン(LIFF)に置き換え可能（docs/01-architecture.md §3.6）。
-- =============================================================================

CREATE TABLE IF NOT EXISTS patient_user (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id),
  patient_id   uuid NOT NULL REFERENCES patient(id),
  auth_user_id uuid NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_user_patient ON patient_user(patient_id);

ALTER TABLE patient_user ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patient_user_self ON patient_user;
CREATE POLICY patient_user_self ON patient_user
  USING (auth_user_id = auth.uid());

-- ログイン中の患者 ID（患者でなければ NULL）
CREATE OR REPLACE FUNCTION app_current_patient() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT patient_id FROM patient_user WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- 患者本人: 自分の patient 行を参照
DROP POLICY IF EXISTS patient_self_select ON patient;
CREATE POLICY patient_self_select ON patient FOR SELECT
  USING (id = app_current_patient());

-- 患者本人: 自分のカバー/問診を参照
DROP POLICY IF EXISTS cover_self_select ON karte_cover;
CREATE POLICY cover_self_select ON karte_cover FOR SELECT
  USING (patient_id = app_current_patient());
DROP POLICY IF EXISTS intake_self_select ON patient_intake;
CREATE POLICY intake_self_select ON patient_intake FOR SELECT
  USING (patient_id = app_current_patient());

-- 患者本人: 自分のデイリーを参照・作成・更新
DROP POLICY IF EXISTS daily_self ON daily_record;
CREATE POLICY daily_self ON daily_record
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());

-- 婦人科拡張（親 daily_record が本人のもの）
DROP POLICY IF EXISTS gyneco_self ON gyneco_daily;
CREATE POLICY gyneco_self ON gyneco_daily
  USING (EXISTS (SELECT 1 FROM daily_record d WHERE d.id = gyneco_daily.daily_record_id AND d.patient_id = app_current_patient()))
  WITH CHECK (EXISTS (SELECT 1 FROM daily_record d WHERE d.id = gyneco_daily.daily_record_id AND d.patient_id = app_current_patient()));

-- アスリート拡張
DROP POLICY IF EXISTS athlete_self ON athlete_daily;
CREATE POLICY athlete_self ON athlete_daily
  USING (EXISTS (SELECT 1 FROM daily_record d WHERE d.id = athlete_daily.daily_record_id AND d.patient_id = app_current_patient()))
  WITH CHECK (EXISTS (SELECT 1 FROM daily_record d WHERE d.id = athlete_daily.daily_record_id AND d.patient_id = app_current_patient()));

-- セルフケア
DROP POLICY IF EXISTS selfcare_self ON selfcare_log;
CREATE POLICY selfcare_self ON selfcare_log
  USING (EXISTS (SELECT 1 FROM daily_record d WHERE d.id = selfcare_log.daily_record_id AND d.patient_id = app_current_patient()))
  WITH CHECK (EXISTS (SELECT 1 FROM daily_record d WHERE d.id = selfcare_log.daily_record_id AND d.patient_id = app_current_patient()));
