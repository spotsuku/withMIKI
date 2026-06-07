-- =============================================================================
-- 0014_patient_invite.sql  ★Supabase 専用
-- 患者ログイン招待を「URL方式」にするためのトークン置き場。
--   先生：自テナントの患者に対し招待トークン(URL)を発行
--   患者：URLを開き、LINEログイン or メール+パスワードでアカウントを受け取る
--         （受け取り処理は patient アプリのサーバー側が service role で実行）
-- =============================================================================

CREATE TABLE IF NOT EXISTS patient_invite (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  patient_id  uuid NOT NULL REFERENCES patient(id),
  token       text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_patient_invite_patient ON patient_invite(patient_id);

ALTER TABLE patient_invite ENABLE ROW LEVEL SECURITY;

-- 先生：自テナントの招待を管理
DROP POLICY IF EXISTS patient_invite_staff ON patient_invite;
CREATE POLICY patient_invite_staff ON patient_invite
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON patient_invite TO authenticated;
