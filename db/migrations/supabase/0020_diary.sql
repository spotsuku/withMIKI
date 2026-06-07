-- =============================================================================
-- 0020_diary.sql  ★Supabase 専用
-- 患者の日記（自由記述）。エントリごとに「先生へ公開/非公開」を選べる。
--   - 患者：自分の日記を全操作
--   - 施術者：自テナントの「公開」エントリのみ参照
-- =============================================================================

CREATE TABLE IF NOT EXISTS diary_entry (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  patient_id uuid NOT NULL REFERENCES patient(id),
  entry_date date NOT NULL DEFAULT current_date,
  mood       text,
  title      text,
  body       text NOT NULL DEFAULT '',
  is_shared  boolean NOT NULL DEFAULT false,   -- 既定は非公開（患者が公開を選ぶ）
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_diary_patient ON diary_entry(patient_id, entry_date DESC);

DROP TRIGGER IF EXISTS trg_diary_updated ON diary_entry;
CREATE TRIGGER trg_diary_updated BEFORE UPDATE ON diary_entry
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE diary_entry ENABLE ROW LEVEL SECURITY;

-- 患者本人：自分の日記を全操作
DROP POLICY IF EXISTS diary_self ON diary_entry;
CREATE POLICY diary_self ON diary_entry
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());

-- 施術者：自テナントの「公開」エントリのみ参照
DROP POLICY IF EXISTS diary_staff ON diary_entry;
CREATE POLICY diary_staff ON diary_entry FOR SELECT
  USING (tenant_id = app_current_tenant() AND is_shared AND deleted_at IS NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON diary_entry TO authenticated;
