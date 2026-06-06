-- =============================================================================
-- 0010_karte_share.sql  ★Supabase 専用
-- 基本カルテの「共有リンク」発行用テーブル。
-- 受け取った人はトークン付きURLでログイン不要・閲覧専用で基本カルテを見られる
-- （公開ページはサーバー側のサービスロールでトークン検証して取得する）。
-- =============================================================================

CREATE TABLE IF NOT EXISTS karte_share (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  patient_id  uuid NOT NULL REFERENCES patient(id),
  token       text NOT NULL UNIQUE,
  scope       text NOT NULL DEFAULT 'basic',   -- basic（基本カルテ）
  label       text,                            -- 送付先メモ
  expires_at  timestamptz,                     -- 有効期限（NULL=無期限）
  revoked_at  timestamptz,                     -- 失効
  created_by  uuid REFERENCES app_user(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_karte_share_patient ON karte_share(patient_id);
CREATE INDEX IF NOT EXISTS idx_karte_share_token ON karte_share(token);

ALTER TABLE karte_share ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS karte_share_tenant ON karte_share;
CREATE POLICY karte_share_tenant ON karte_share
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON karte_share TO authenticated;
-- 公開ページ(/share/[token])はサービスロールで取得するため public ポリシーは設けない
