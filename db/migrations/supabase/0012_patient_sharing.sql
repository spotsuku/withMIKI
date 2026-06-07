-- =============================================================================
-- 0012_patient_sharing.sql  ★Supabase 専用
-- 患者が「自分の記録の項目ごとに 公開/非公開」を設定し、施術者へ共有する。
--   - 患者：自分の設定を読み書き
--   - 施術者：自テナント患者の設定を参照（公開項目だけ画面表示に利用）
-- =============================================================================

CREATE TABLE IF NOT EXISTS patient_share_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  patient_id uuid NOT NULL REFERENCES patient(id),
  section    text NOT NULL,                 -- menstrual/pms/oriental/body/selfcare/meds/food/labs/media
  is_shared  boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, section)
);
CREATE INDEX IF NOT EXISTS idx_share_settings_patient ON patient_share_settings(patient_id);
DROP TRIGGER IF EXISTS trg_share_settings_updated ON patient_share_settings;
CREATE TRIGGER trg_share_settings_updated BEFORE UPDATE ON patient_share_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE patient_share_settings ENABLE ROW LEVEL SECURITY;

-- 患者本人：自分の設定を全操作
DROP POLICY IF EXISTS share_settings_self ON patient_share_settings;
CREATE POLICY share_settings_self ON patient_share_settings
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());

-- 施術者：自テナントの設定を参照
DROP POLICY IF EXISTS share_settings_staff ON patient_share_settings;
CREATE POLICY share_settings_staff ON patient_share_settings FOR SELECT
  USING (tenant_id = app_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON patient_share_settings TO authenticated;
