-- =============================================================================
-- 0022_karte_visibility.sql  ★Supabase 専用
-- 先生が「基本カルテのどの部分を患者に見せるか」を設定する（先生→患者の公開制御）。
--   既定はすべて公開（行が無ければ visible=true 扱い）。
--   - 先生：自テナントの設定を全操作
--   - 患者：自分の設定を参照（どこを表示するか判断するため）
-- =============================================================================

CREATE TABLE IF NOT EXISTS karte_visibility (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  patient_id uuid NOT NULL REFERENCES patient(id),
  section    text NOT NULL,                 -- careplan/intake/problems/visits/labs
  visible    boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, section)
);
CREATE INDEX IF NOT EXISTS idx_karte_vis_patient ON karte_visibility(patient_id);
DROP TRIGGER IF EXISTS trg_karte_vis_updated ON karte_visibility;
CREATE TRIGGER trg_karte_vis_updated BEFORE UPDATE ON karte_visibility
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE karte_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS karte_vis_staff ON karte_visibility;
CREATE POLICY karte_vis_staff ON karte_visibility
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS karte_vis_self ON karte_visibility;
CREATE POLICY karte_vis_self ON karte_visibility FOR SELECT
  USING (patient_id = app_current_patient());

GRANT SELECT, INSERT, UPDATE, DELETE ON karte_visibility TO authenticated;
