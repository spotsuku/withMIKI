-- =============================================================================
-- 0019_patient_record_token.sql  ★Supabase 専用
-- ログイン不要でカルテ記録を使える「トークンURL＋PIN」用。
--   先生が患者ごとにトークンURLを発行 → 患者はURLを開きPINで記録（アカウント不要）。
--   トークン→patient なので先生は誰のデータか分かる。PINで第三者アクセスを防止。
--   公開アクセスは patient アプリのサーバー側が service role で検証して実行する。
-- =============================================================================

CREATE TABLE IF NOT EXISTS patient_record_token (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id),
  patient_id   uuid NOT NULL REFERENCES patient(id),
  token        text NOT NULL UNIQUE,
  pin_hash     text,                 -- 初回設定まで NULL
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked      boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_prt_patient ON patient_record_token(patient_id);

ALTER TABLE patient_record_token ENABLE ROW LEVEL SECURITY;

-- 先生：自テナントのトークンを管理
DROP POLICY IF EXISTS prt_staff ON patient_record_token;
CREATE POLICY prt_staff ON patient_record_token
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON patient_record_token TO authenticated;
