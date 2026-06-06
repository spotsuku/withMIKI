-- =============================================================================
-- WithMIKI データベーススキーマ (PostgreSQL 15+)
-- 設計思想: 共通カルテ基盤(コア) + 対象別ケアプログラム(モジュール) + 観測モデル(拡張)
-- 詳細は docs/02-database-design.md を参照。
-- このファイルは設計の「正本」。変更時は db/migrations/ に追番マイグレーションを追加すること。
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- 大小無視メール/コード

-- 共通の updated_at 自動更新トリガ関数
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. テナント / ユーザー（外販の土台）
-- -----------------------------------------------------------------------------
CREATE TABLE tenant (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'free',
  status      text NOT NULL DEFAULT 'active',  -- active / suspended
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_tenant_updated BEFORE UPDATE ON tenant
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE app_user (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  email         citext NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'practitioner',  -- owner / practitioner / staff
  license_type  text,                                  -- 鍼灸師 / AT / 医師 等
  auth_provider text,
  auth_subject  text,
  status        text NOT NULL DEFAULT 'active',         -- active / invited / disabled
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE TRIGGER trg_user_updated BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. ケアプログラム（対象別カルテの定義：master を親とするツリー）
-- -----------------------------------------------------------------------------
CREATE TABLE care_program (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenant(id),         -- NULL = システム標準
  code         text NOT NULL,                      -- master / gyneco / athlete / 任意
  name         text NOT NULL,
  parent_id    uuid REFERENCES care_program(id),   -- master を親にした自己参照
  record_kind  text NOT NULL DEFAULT 'generic',    -- none / gyneco / athlete / generic
  form_schema  jsonb NOT NULL DEFAULT '{}'::jsonb, -- 患者入力フォーム定義
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE TRIGGER trg_program_updated BEFORE UPDATE ON care_program
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. 患者・カルテ基盤（共通コア）
-- -----------------------------------------------------------------------------
CREATE TABLE patient (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenant(id),
  code             text,                       -- 院内患者番号
  name             text NOT NULL,
  kana             text,
  dob              date,
  sex              text,
  blood_type       text,
  tel              text,
  tel2             text,
  email            citext,
  address          text,
  job              text,
  first_visit_date date,
  referrer         text,
  route            text,
  emergency_name   text,
  emergency_rel    text,
  emergency_tel    text,
  hospital         text,
  avatar           text,                       -- 絵文字 or 写真参照
  status           text NOT NULL DEFAULT 'active',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES app_user(id),
  updated_by       uuid REFERENCES app_user(id),
  deleted_at       timestamptz
);
CREATE INDEX idx_patient_tenant_code ON patient(tenant_id, code);
CREATE INDEX idx_patient_tenant_name ON patient(tenant_id, name);
CREATE TRIGGER trg_patient_updated BEFORE UPDATE ON patient
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE patient_program (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id),
  patient_id      uuid NOT NULL REFERENCES patient(id),
  care_program_id uuid NOT NULL REFERENCES care_program(id),
  started_at      date,
  ended_at        date,
  is_primary      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patient_program_patient ON patient_program(patient_id);

CREATE TABLE patient_intake (
  patient_id uuid PRIMARY KEY REFERENCES patient(id),
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  chief      text,   -- 主訴
  onset      text,   -- 発症
  "current"  text,   -- 現病歴
  history    text,   -- 既往歴
  sleep      text,
  appetite   text,
  meds       text,   -- 服薬
  note       text,   -- 禁忌・備考
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES app_user(id)
);
CREATE TRIGGER trg_intake_updated BEFORE UPDATE ON patient_intake
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE karte_cover (
  patient_id uuid PRIMARY KEY REFERENCES patient(id),
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  purpose    text,
  therapist  text,
  goal       text,
  diagnosis  text,
  history    text,
  treatment  text,
  caution    text,
  doctor     text,
  start_date date,
  next_visit date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_cover_updated BEFORE UPDATE ON karte_cover
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE problem (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  patient_id uuid NOT NULL REFERENCES patient(id),
  title      text NOT NULL,
  detail     text,
  status     text NOT NULL DEFAULT 'active',  -- active / resolved
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_problem_patient ON problem(patient_id);
CREATE TRIGGER trg_problem_updated BEFORE UPDATE ON problem
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE visit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id),
  patient_id      uuid NOT NULL REFERENCES patient(id),
  visit_date      date NOT NULL,
  injury_part     text,
  injury_name     text,
  disorder_part   text,
  disorder_name   text,
  points          text,        -- 取穴
  technique       text,        -- 手技
  treatments      text[] NOT NULL DEFAULT '{}',
  memo            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES app_user(id),
  deleted_at      timestamptz
);
CREATE INDEX idx_visit_patient_date ON visit(patient_id, visit_date DESC);
CREATE TRIGGER trg_visit_updated BEFORE UPDATE ON visit
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE visit_vital (
  visit_id  uuid PRIMARY KEY REFERENCES visit(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  weight numeric, fat numeric, bmi numeric, temp numeric,
  sbp int, dbp int, hr int, spo2 int,
  hb numeric, ht numeric, rbc numeric, mcv numeric, mch numeric,
  ferritin numeric, fe numeric, tibc numeric, tsat numeric, retic numeric, b12 numeric,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE soap_note (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  patient_id uuid NOT NULL REFERENCES patient(id),
  visit_id   uuid REFERENCES visit(id),
  note_date  date NOT NULL,
  s text, o text, a text, p text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  deleted_at timestamptz
);
CREATE INDEX idx_soap_patient_date ON soap_note(patient_id, note_date DESC);

CREATE TABLE body_diagram (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  patient_id uuid NOT NULL REFERENCES patient(id),
  visit_id   uuid REFERENCES visit(id),
  view       text NOT NULL,                       -- front / back
  marks      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{x,y,color,size}]
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_body_patient ON body_diagram(patient_id);

-- -----------------------------------------------------------------------------
-- 4. デイリーレコード（共通 + 対象別拡張）
-- -----------------------------------------------------------------------------
CREATE TABLE daily_record (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id),
  patient_id      uuid NOT NULL REFERENCES patient(id),
  care_program_id uuid REFERENCES care_program(id),
  record_date     date NOT NULL,
  weight numeric, body_fat numeric, muscle_mass numeric, height numeric,
  sbp int, dbp int, hr int,
  body_temp numeric,
  sleep_hours numeric, sleep_quality text,
  water numeric, exercise text,
  condition text, memo text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,    -- 院独自の自由項目
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'patient',         -- patient / import / line
  UNIQUE (patient_id, record_date)
);
CREATE INDEX idx_daily_patient_date ON daily_record(patient_id, record_date DESC);
CREATE TRIGGER trg_daily_updated BEFORE UPDATE ON daily_record
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE gyneco_daily (
  daily_record_id uuid PRIMARY KEY REFERENCES daily_record(id) ON DELETE CASCADE,
  bbt numeric,
  cycle_day int,
  menstrual text,
  flow text,
  blood_state text[] NOT NULL DEFAULT '{}',
  discharge_amt text,
  discharge_state text[] NOT NULL DEFAULT '{}',
  cervical text,
  ov_test text,
  ov_pain text[] NOT NULL DEFAULT '{}',
  sex text,
  sex_note text[] NOT NULL DEFAULT '{}',
  breast text[] NOT NULL DEFAULT '{}',
  pms_physical text[] NOT NULL DEFAULT '{}',
  pms_mental text[] NOT NULL DEFAULT '{}',
  pain int,
  pain_location text[] NOT NULL DEFAULT '{}',
  chill_area text[] NOT NULL DEFAULT '{}',
  edema_area text[] NOT NULL DEFAULT '{}',
  tongue text[] NOT NULL DEFAULT '{}',
  oriental text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE athlete_daily (
  daily_record_id uuid PRIMARY KEY REFERENCES daily_record(id) ON DELETE CASCADE,
  injury text,
  condition_score int,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE selfcare_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_record_id uuid NOT NULL REFERENCES daily_record(id) ON DELETE CASCADE,
  selfcare_code   text NOT NULL,   -- iap/pelvic/autonomic/stretch/lymph/walk ...
  done            boolean NOT NULL DEFAULT false,
  UNIQUE (daily_record_id, selfcare_code)
);

CREATE TABLE medication (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  patient_id uuid NOT NULL REFERENCES patient(id),
  name       text NOT NULL,
  is_custom  boolean NOT NULL DEFAULT false,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_medication_patient ON medication(patient_id);

CREATE TABLE medication_log (
  daily_record_id uuid NOT NULL REFERENCES daily_record(id) ON DELETE CASCADE,
  medication_id   uuid NOT NULL REFERENCES medication(id),
  taken           boolean NOT NULL DEFAULT false,
  PRIMARY KEY (daily_record_id, medication_id)
);

-- -----------------------------------------------------------------------------
-- 5. トレーニング・栄養
-- -----------------------------------------------------------------------------
CREATE TABLE training_session (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id),
  patient_id   uuid NOT NULL REFERENCES patient(id),
  session_date date NOT NULL,
  type         text,
  duration_min int,
  intensity    text,
  volume       text,
  memo         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX idx_training_patient_date ON training_session(patient_id, session_date DESC);

CREATE TABLE nutrition_goal (
  patient_id    uuid PRIMARY KEY REFERENCES patient(id),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  calories      numeric,
  protein       numeric,
  carbs         numeric,
  fat           numeric,
  target_weight numeric,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_nutrition_updated BEFORE UPDATE ON nutrition_goal
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- attachment は §7 で定義するが food_entry/media/lab から参照するため先に定義
CREATE TABLE attachment (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id),
  patient_id   uuid REFERENCES patient(id),
  kind         text NOT NULL,    -- food_photo/lab_image/body_photo/media/intake/import/consent
  storage_key  text NOT NULL,
  mime         text,
  size_bytes   bigint,
  sha256       text,
  is_encrypted boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachment_patient ON attachment(patient_id);

CREATE TABLE food_entry (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenant(id),
  patient_id          uuid NOT NULL REFERENCES patient(id),
  entry_date          date NOT NULL,
  meal                text,    -- 朝/昼/夕/間食
  photo_attachment_id uuid REFERENCES attachment(id),
  memo                text,
  calories numeric, protein numeric, carbs numeric, fat numeric,
  ai_analysis jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_food_patient_date ON food_entry(patient_id, entry_date DESC);

-- -----------------------------------------------------------------------------
-- 6. 採血（拡張可能な検査モデル）
-- -----------------------------------------------------------------------------
CREATE TABLE lab_test_catalog (
  code       text PRIMARY KEY,    -- hb/ferritin/e2/p4/fsh/lh/amh/ck/testosterone ...
  name       text NOT NULL,
  unit       text,
  ref_low    numeric,
  ref_high   numeric,
  category   text,                -- 血算/鉄/ホルモン/代謝 ...
  applies_to text[] NOT NULL DEFAULT '{general}',  -- {gyneco,athlete,general}
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE lab_result (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenant(id),
  patient_id          uuid NOT NULL REFERENCES patient(id),
  taken_date          date NOT NULL,
  source              text NOT NULL DEFAULT 'manual',  -- manual / ocr
  image_attachment_id uuid REFERENCES attachment(id),
  comment             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX idx_lab_patient_date ON lab_result(patient_id, taken_date DESC);

CREATE TABLE lab_value (
  lab_result_id uuid NOT NULL REFERENCES lab_result(id) ON DELETE CASCADE,
  test_code     text NOT NULL REFERENCES lab_test_catalog(code),
  value         numeric,
  value_text    text,
  PRIMARY KEY (lab_result_id, test_code)
);
CREATE INDEX idx_lab_value_code ON lab_value(test_code);

-- -----------------------------------------------------------------------------
-- 7. メディア
-- -----------------------------------------------------------------------------
CREATE TABLE media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  patient_id    uuid NOT NULL REFERENCES patient(id),
  visit_id      uuid REFERENCES visit(id),
  category      text,
  title         text,
  memo          text,
  taken_date    date,
  attachment_id uuid REFERENCES attachment(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX idx_media_patient ON media(patient_id);

-- -----------------------------------------------------------------------------
-- 8. 汎用観測モデル（将来対象を“設定”で追加：スキーマ変更不要）
-- -----------------------------------------------------------------------------
CREATE TABLE observation_definition (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenant(id),     -- NULL = 標準
  care_program_id uuid REFERENCES care_program(id),
  code            text NOT NULL,
  label           text NOT NULL,
  data_type       text NOT NULL,    -- number/text/boolean/single/multi/date
  options         jsonb,            -- 選択肢
  unit            text,
  sort_order      int NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_obsdef_program ON observation_definition(care_program_id);

CREATE TABLE observation (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id),
  definition_id   uuid NOT NULL REFERENCES observation_definition(id),
  patient_id      uuid NOT NULL REFERENCES patient(id),
  daily_record_id uuid REFERENCES daily_record(id) ON DELETE CASCADE,
  visit_id        uuid REFERENCES visit(id),
  observed_at     timestamptz NOT NULL DEFAULT now(),
  num_value       numeric,
  text_value      text,
  bool_value      boolean,
  array_value     text[]
);
CREATE INDEX idx_observation_trend ON observation(patient_id, definition_id, observed_at);

-- -----------------------------------------------------------------------------
-- 9. 連携・運用（LINE / 移行 / AI / 同意 / 監査）
-- -----------------------------------------------------------------------------
CREATE TABLE line_account (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id),
  patient_id   uuid NOT NULL REFERENCES patient(id),
  line_user_id text NOT NULL UNIQUE,
  linked_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE line_inbound_message (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id text NOT NULL,
  patient_id   uuid REFERENCES patient(id),
  message_type text NOT NULL,    -- text / file / postback
  payload      jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX idx_line_inbound_user ON line_inbound_message(line_user_id);
CREATE INDEX idx_line_inbound_unprocessed ON line_inbound_message(processed_at) WHERE processed_at IS NULL;

CREATE TABLE import_job (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id),
  patient_id      uuid REFERENCES patient(id),
  source_filename text,
  source_kind     text,          -- gyneco_summary / athlete_full / karte_state
  raw_json        jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending',  -- pending/done/failed
  report          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES app_user(id)
);

CREATE TABLE ai_job (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  patient_id    uuid REFERENCES patient(id),
  type          text NOT NULL,   -- lab_ocr/food_analysis/karte_chat/intake_scan
  model         text NOT NULL,
  input_ref     jsonb,
  output        jsonb,
  input_tokens  int,
  output_tokens int,
  cost_usd      numeric,
  status        text NOT NULL DEFAULT 'succeeded',
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES app_user(id)
);
CREATE INDEX idx_ai_job_tenant ON ai_job(tenant_id, created_at DESC);

CREATE TABLE consent (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenant(id),
  patient_id             uuid NOT NULL REFERENCES patient(id),
  consent_type           text NOT NULL,  -- data_processing/ai_analysis/sharing
  granted_at             timestamptz,
  revoked_at             timestamptz,
  document_attachment_id uuid REFERENCES attachment(id),
  version                text
);
CREATE INDEX idx_consent_patient ON consent(patient_id);

CREATE TABLE audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  actor_user_id uuid REFERENCES app_user(id),
  actor_kind    text NOT NULL DEFAULT 'user',  -- user / patient / system
  action        text NOT NULL,                 -- create/read/update/delete/export/login
  entity        text NOT NULL,
  entity_id     uuid,
  ip            text,
  user_agent    text,
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant_at ON audit_log(tenant_id, at DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);

-- =============================================================================
-- 10. Row-Level Security（テナント分離）
--   API は接続時に  SET app.tenant_id = '<uuid>';  を実行する前提。
--   ここでは代表テーブルのみ例示。全業務テーブルに同様のポリシーを適用すること。
-- =============================================================================
ALTER TABLE patient        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_record   ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_result     ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_patient ON patient
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_daily ON daily_record
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_visit ON visit
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_lab ON lab_result
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
