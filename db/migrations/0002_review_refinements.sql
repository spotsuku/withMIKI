-- =============================================================================
-- 0002_review_refinements.sql
-- docs/07-db-design-review.md で合意した改善を適用する。
--   1. 全業務テーブルで RLS 有効化（子テーブルは親経由ポリシー）
--   2. daily_record.deleted_at 追加 + 部分ユニークインデックス化
--   3. tenant_id・主要FKへインデックス追加
--   4. medication(patient_id, name) ユニーク
-- 適用前提: schema.sql 適用済み。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2. daily_record: 論理削除列 + 部分ユニーク
-- -----------------------------------------------------------------------------
ALTER TABLE daily_record ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
-- 既存の UNIQUE(patient_id, record_date) を部分ユニークへ置換
ALTER TABLE daily_record DROP CONSTRAINT IF EXISTS daily_record_patient_id_record_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_active
  ON daily_record(patient_id, record_date) WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 3. tenant_id / 主要FK インデックス
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_patient_tenant        ON patient(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visit_tenant          ON visit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_tenant          ON daily_record(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lab_result_tenant     ON lab_result(tenant_id);
CREATE INDEX IF NOT EXISTS idx_soap_tenant           ON soap_note(tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_tenant          ON media(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_tenant       ON training_session(tenant_id);
CREATE INDEX IF NOT EXISTS idx_food_tenant           ON food_entry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_observation_tenant    ON observation(tenant_id);

CREATE INDEX IF NOT EXISTS idx_soap_visit            ON soap_note(visit_id);
CREATE INDEX IF NOT EXISTS idx_media_visit           ON media(visit_id);
CREATE INDEX IF NOT EXISTS idx_media_attachment      ON media(attachment_id);
CREATE INDEX IF NOT EXISTS idx_food_photo            ON food_entry(photo_attachment_id);
CREATE INDEX IF NOT EXISTS idx_lab_value_result      ON lab_value(lab_result_id);
CREATE INDEX IF NOT EXISTS idx_selfcare_daily        ON selfcare_log(daily_record_id);
CREATE INDEX IF NOT EXISTS idx_medlog_daily          ON medication_log(daily_record_id);

-- -----------------------------------------------------------------------------
-- 4. medication 同名重複防止
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_medication_patient_name
  ON medication(patient_id, name);

-- -----------------------------------------------------------------------------
-- 1. RLS 全業務テーブル
--    (a) tenant_id を持つテーブル: 直接ポリシー
--    (b) 子テーブル(tenant_id なし): 親経由 EXISTS ポリシー
-- -----------------------------------------------------------------------------

-- (a) tenant_id 直接フィルタ
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
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
    $p$, t);
  END LOOP;
END $$;

-- (b) 親経由ポリシー（tenant_id を持たない子テーブル）
ALTER TABLE gyneco_daily   ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_daily  ENABLE ROW LEVEL SECURITY;
ALTER TABLE selfcare_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_vital    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_value      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_isolation_gyneco_daily ON gyneco_daily;
DROP POLICY IF EXISTS parent_isolation_athlete_daily ON athlete_daily;
DROP POLICY IF EXISTS parent_isolation_selfcare_log ON selfcare_log;
DROP POLICY IF EXISTS parent_isolation_medication_log ON medication_log;
DROP POLICY IF EXISTS parent_isolation_visit_vital ON visit_vital;
DROP POLICY IF EXISTS parent_isolation_lab_value ON lab_value;

CREATE POLICY parent_isolation_gyneco_daily ON gyneco_daily USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = gyneco_daily.daily_record_id
            AND d.tenant_id = current_setting('app.tenant_id', true)::uuid));

CREATE POLICY parent_isolation_athlete_daily ON athlete_daily USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = athlete_daily.daily_record_id
            AND d.tenant_id = current_setting('app.tenant_id', true)::uuid));

CREATE POLICY parent_isolation_selfcare_log ON selfcare_log USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = selfcare_log.daily_record_id
            AND d.tenant_id = current_setting('app.tenant_id', true)::uuid));

CREATE POLICY parent_isolation_medication_log ON medication_log USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = medication_log.daily_record_id
            AND d.tenant_id = current_setting('app.tenant_id', true)::uuid));

CREATE POLICY parent_isolation_visit_vital ON visit_vital USING (
  EXISTS (SELECT 1 FROM visit v
          WHERE v.id = visit_vital.visit_id
            AND v.tenant_id = current_setting('app.tenant_id', true)::uuid));

CREATE POLICY parent_isolation_lab_value ON lab_value USING (
  EXISTS (SELECT 1 FROM lab_result r
          WHERE r.id = lab_value.lab_result_id
            AND r.tenant_id = current_setting('app.tenant_id', true)::uuid));

-- 注: lab_test_catalog はテナント非依存の共有マスタのため RLS 対象外。
