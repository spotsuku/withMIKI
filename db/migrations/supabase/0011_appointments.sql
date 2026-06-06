-- =============================================================================
-- 0011_appointments.sql  ★Supabase 専用
-- 予約システム：予約(appointments)・空き枠(appointment_slots)・テナント設定(tenant_settings)。
--   - 先生：tenant_id で自院の予約/枠/設定を管理
--   - 患者：自分の予約(patient_id)を参照／公開予約は booking_token でサーバー経由
--   - Google Calendar トークンは tenant_settings にサーバー専用で保存
-- =============================================================================

CREATE TABLE IF NOT EXISTS appointments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  patient_id    uuid REFERENCES patient(id),       -- 既存患者（公開予約では NULL の場合あり）
  title         text,                              -- メニュー名・件名
  start_at      timestamptz NOT NULL,
  end_at        timestamptz NOT NULL,
  google_event_id text,
  status        text NOT NULL DEFAULT 'pending',   -- pending / confirmed / cancelled
  notes         text,
  guest_name    text,                              -- 公開予約の氏名
  guest_email   citext,                            -- 公開予約のメール
  booking_token text NOT NULL UNIQUE,              -- 予約ごとの確認/変更/キャンセル用
  created_by    uuid REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  cancelled_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_appt_tenant_start ON appointments(tenant_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appt_patient_start ON appointments(patient_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appt_booking_token ON appointments(booking_token);
DROP TRIGGER IF EXISTS trg_appt_updated ON appointments;
CREATE TRIGGER trg_appt_updated BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS appointment_slots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id),
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  is_blocked      boolean NOT NULL DEFAULT false,  -- true=受付不可（Google予定等でブロック）
  google_event_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slot_tenant_start ON appointment_slots(tenant_id, start_at);

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id     uuid PRIMARY KEY REFERENCES tenant(id),
  booking_token text UNIQUE,            -- 公開予約ページ /book/[token] 用（院単位）
  google_token  jsonb,                  -- access_token/refresh_token/expiry（サーバー専用）
  google_calendar_id text,
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_tenant_settings_updated ON tenant_settings;
CREATE TRIGGER trg_tenant_settings_updated BEFORE UPDATE ON tenant_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== RLS =====
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

-- 予約：先生=自テナント、患者=自分の予約
DROP POLICY IF EXISTS appt_staff ON appointments;
CREATE POLICY appt_staff ON appointments
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
DROP POLICY IF EXISTS appt_patient ON appointments;
CREATE POLICY appt_patient ON appointments
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());

-- 空き枠：先生=自テナント（公開ページはサービスロールで取得）
DROP POLICY IF EXISTS slot_staff ON appointment_slots;
CREATE POLICY slot_staff ON appointment_slots
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

-- テナント設定：先生=自テナントのみ（Google トークンは別途サーバー専用扱い）
DROP POLICY IF EXISTS tenant_settings_staff ON tenant_settings;
CREATE POLICY tenant_settings_staff ON tenant_settings
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON appointment_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_settings TO authenticated;
