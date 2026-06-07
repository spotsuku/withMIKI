-- =============================================================================
-- WithMIKI Supabase 一括適用SQL（自動生成・直接編集しない・★冪等：何度でもOK）
-- 順: schema → 0001..0003 → 0004..0012
-- =============================================================================

-- ===== db/schema.sql =====

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
CREATE TABLE IF NOT EXISTS tenant (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'free',
  status      text NOT NULL DEFAULT 'active',  -- active / suspended
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_tenant_updated ON tenant;
CREATE TRIGGER trg_tenant_updated BEFORE UPDATE ON tenant
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS app_user (
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
DROP TRIGGER IF EXISTS trg_user_updated ON app_user;
CREATE TRIGGER trg_user_updated BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. ケアプログラム（対象別カルテの定義：master を親とするツリー）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS care_program (
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
DROP TRIGGER IF EXISTS trg_program_updated ON care_program;
CREATE TRIGGER trg_program_updated BEFORE UPDATE ON care_program
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. 患者・カルテ基盤（共通コア）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient (
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
CREATE INDEX IF NOT EXISTS idx_patient_tenant_code ON patient(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_patient_tenant_name ON patient(tenant_id, name);
DROP TRIGGER IF EXISTS trg_patient_updated ON patient;
CREATE TRIGGER trg_patient_updated BEFORE UPDATE ON patient
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS patient_program (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id),
  patient_id      uuid NOT NULL REFERENCES patient(id),
  care_program_id uuid NOT NULL REFERENCES care_program(id),
  started_at      date,
  ended_at        date,
  is_primary      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_program_patient ON patient_program(patient_id);

CREATE TABLE IF NOT EXISTS patient_intake (
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
DROP TRIGGER IF EXISTS trg_intake_updated ON patient_intake;
CREATE TRIGGER trg_intake_updated BEFORE UPDATE ON patient_intake
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS karte_cover (
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
DROP TRIGGER IF EXISTS trg_cover_updated ON karte_cover;
CREATE TRIGGER trg_cover_updated BEFORE UPDATE ON karte_cover
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS problem (
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
CREATE INDEX IF NOT EXISTS idx_problem_patient ON problem(patient_id);
DROP TRIGGER IF EXISTS trg_problem_updated ON problem;
CREATE TRIGGER trg_problem_updated BEFORE UPDATE ON problem
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS visit (
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
CREATE INDEX IF NOT EXISTS idx_visit_patient_date ON visit(patient_id, visit_date DESC);
DROP TRIGGER IF EXISTS trg_visit_updated ON visit;
CREATE TRIGGER trg_visit_updated BEFORE UPDATE ON visit
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS visit_vital (
  visit_id  uuid PRIMARY KEY REFERENCES visit(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  weight numeric, fat numeric, bmi numeric, temp numeric,
  sbp int, dbp int, hr int, spo2 int,
  hb numeric, ht numeric, rbc numeric, mcv numeric, mch numeric,
  ferritin numeric, fe numeric, tibc numeric, tsat numeric, retic numeric, b12 numeric,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS soap_note (
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
CREATE INDEX IF NOT EXISTS idx_soap_patient_date ON soap_note(patient_id, note_date DESC);

CREATE TABLE IF NOT EXISTS body_diagram (
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
CREATE INDEX IF NOT EXISTS idx_body_patient ON body_diagram(patient_id);

-- -----------------------------------------------------------------------------
-- 4. デイリーレコード（共通 + 対象別拡張）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_record (
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
CREATE INDEX IF NOT EXISTS idx_daily_patient_date ON daily_record(patient_id, record_date DESC);
DROP TRIGGER IF EXISTS trg_daily_updated ON daily_record;
CREATE TRIGGER trg_daily_updated BEFORE UPDATE ON daily_record
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS gyneco_daily (
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

CREATE TABLE IF NOT EXISTS athlete_daily (
  daily_record_id uuid PRIMARY KEY REFERENCES daily_record(id) ON DELETE CASCADE,
  injury text,
  condition_score int,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS selfcare_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_record_id uuid NOT NULL REFERENCES daily_record(id) ON DELETE CASCADE,
  selfcare_code   text NOT NULL,   -- iap/pelvic/autonomic/stretch/lymph/walk ...
  done            boolean NOT NULL DEFAULT false,
  UNIQUE (daily_record_id, selfcare_code)
);

CREATE TABLE IF NOT EXISTS medication (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  patient_id uuid NOT NULL REFERENCES patient(id),
  name       text NOT NULL,
  is_custom  boolean NOT NULL DEFAULT false,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medication_patient ON medication(patient_id);

CREATE TABLE IF NOT EXISTS medication_log (
  daily_record_id uuid NOT NULL REFERENCES daily_record(id) ON DELETE CASCADE,
  medication_id   uuid NOT NULL REFERENCES medication(id),
  taken           boolean NOT NULL DEFAULT false,
  PRIMARY KEY (daily_record_id, medication_id)
);

-- -----------------------------------------------------------------------------
-- 5. トレーニング・栄養
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_session (
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
CREATE INDEX IF NOT EXISTS idx_training_patient_date ON training_session(patient_id, session_date DESC);

CREATE TABLE IF NOT EXISTS nutrition_goal (
  patient_id    uuid PRIMARY KEY REFERENCES patient(id),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  calories      numeric,
  protein       numeric,
  carbs         numeric,
  fat           numeric,
  target_weight numeric,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_nutrition_updated ON nutrition_goal;
CREATE TRIGGER trg_nutrition_updated BEFORE UPDATE ON nutrition_goal
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- attachment は §7 で定義するが food_entry/media/lab から参照するため先に定義
CREATE TABLE IF NOT EXISTS attachment (
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
CREATE INDEX IF NOT EXISTS idx_attachment_patient ON attachment(patient_id);

CREATE TABLE IF NOT EXISTS food_entry (
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
CREATE INDEX IF NOT EXISTS idx_food_patient_date ON food_entry(patient_id, entry_date DESC);

-- -----------------------------------------------------------------------------
-- 6. 採血（拡張可能な検査モデル）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lab_test_catalog (
  code       text PRIMARY KEY,    -- hb/ferritin/e2/p4/fsh/lh/amh/ck/testosterone ...
  name       text NOT NULL,
  unit       text,
  ref_low    numeric,
  ref_high   numeric,
  category   text,                -- 血算/鉄/ホルモン/代謝 ...
  applies_to text[] NOT NULL DEFAULT '{general}',  -- {gyneco,athlete,general}
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lab_result (
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
CREATE INDEX IF NOT EXISTS idx_lab_patient_date ON lab_result(patient_id, taken_date DESC);

CREATE TABLE IF NOT EXISTS lab_value (
  lab_result_id uuid NOT NULL REFERENCES lab_result(id) ON DELETE CASCADE,
  test_code     text NOT NULL REFERENCES lab_test_catalog(code),
  value         numeric,
  value_text    text,
  PRIMARY KEY (lab_result_id, test_code)
);
CREATE INDEX IF NOT EXISTS idx_lab_value_code ON lab_value(test_code);

-- -----------------------------------------------------------------------------
-- 7. メディア
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
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
CREATE INDEX IF NOT EXISTS idx_media_patient ON media(patient_id);

-- -----------------------------------------------------------------------------
-- 8. 汎用観測モデル（将来対象を“設定”で追加：スキーマ変更不要）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS observation_definition (
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
CREATE INDEX IF NOT EXISTS idx_obsdef_program ON observation_definition(care_program_id);

CREATE TABLE IF NOT EXISTS observation (
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
CREATE INDEX IF NOT EXISTS idx_observation_trend ON observation(patient_id, definition_id, observed_at);

-- -----------------------------------------------------------------------------
-- 9. 連携・運用（LINE / 移行 / AI / 同意 / 監査）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS line_account (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id),
  patient_id   uuid NOT NULL REFERENCES patient(id),
  line_user_id text NOT NULL UNIQUE,
  linked_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS line_inbound_message (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id text NOT NULL,
  patient_id   uuid REFERENCES patient(id),
  message_type text NOT NULL,    -- text / file / postback
  payload      jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_line_inbound_user ON line_inbound_message(line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_inbound_unprocessed ON line_inbound_message(processed_at) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS import_job (
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

CREATE TABLE IF NOT EXISTS ai_job (
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
CREATE INDEX IF NOT EXISTS idx_ai_job_tenant ON ai_job(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS consent (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenant(id),
  patient_id             uuid NOT NULL REFERENCES patient(id),
  consent_type           text NOT NULL,  -- data_processing/ai_analysis/sharing
  granted_at             timestamptz,
  revoked_at             timestamptz,
  document_attachment_id uuid REFERENCES attachment(id),
  version                text
);
CREATE INDEX IF NOT EXISTS idx_consent_patient ON consent(patient_id);

CREATE TABLE IF NOT EXISTS audit_log (
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
CREATE INDEX IF NOT EXISTS idx_audit_tenant_at ON audit_log(tenant_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);

-- =============================================================================
-- 10. Row-Level Security（テナント分離）
--   API は接続時に  SET app.tenant_id = '<uuid>';  を実行する前提。
--   RLS の有効化とポリシーは 0002_review_refinements.sql で「全業務テーブルに」
--   一元的に定義する（ここで重複定義すると名前衝突するため schema.sql 側では行わない）。
--   適用順: schema.sql → migrations/0001 → 0002(RLS) → 0003
-- =============================================================================
-- （RLS は db/migrations/0002_review_refinements.sql を参照）


-- ===== db/migrations/0001_init.sql =====

-- =============================================================================
-- 0001_init.sql  — 初期マイグレーション
--
-- 【設計フェーズの運用について】
--   現フェーズ(Phase 0/設計)では、構造 DDL の「正本」を ../schema.sql に集約している。
--   実装着手(Phase 1)時に、本ファイルへ schema.sql の DDL を取り込み、以降の
--   変更は 0002_*.sql, 0003_*.sql … と追番で積み上げる(既存ファイルは書き換えない)。
--
--   適用順の想定:
--     1) ../schema.sql      … テーブル/インデックス/RLS
--     2) この 0001_init.sql … 標準リファレンスデータ(ケアプログラム/検査カタログ)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 標準ケアプログラム（master を親にした対象別ツリー）
--   tenant_id = NULL のシステム標準。各テナントはこれを複製/上書きして利用する。
-- -----------------------------------------------------------------------------
-- tenant_id が NULL の標準プログラムは UNIQUE(tenant_id,code) で重複検知できないため
-- WHERE NOT EXISTS で冪等化する（何度実行しても重複しない）。
INSERT INTO care_program (id, tenant_id, code, name, parent_id, record_kind, is_active)
SELECT '00000000-0000-0000-0000-000000000001', NULL, 'master', '総合カルテ（共通基盤）', NULL, 'none', true
WHERE NOT EXISTS (SELECT 1 FROM care_program WHERE tenant_id IS NULL AND code = 'master');

INSERT INTO care_program (tenant_id, code, name, parent_id, record_kind, is_active)
SELECT NULL, 'gyneco', '婦人科デイリーレコード', '00000000-0000-0000-0000-000000000001', 'gyneco', true
WHERE NOT EXISTS (SELECT 1 FROM care_program WHERE tenant_id IS NULL AND code = 'gyneco');

INSERT INTO care_program (tenant_id, code, name, parent_id, record_kind, is_active)
SELECT NULL, 'athlete', 'アスリートレコード', '00000000-0000-0000-0000-000000000001', 'athlete', true
WHERE NOT EXISTS (SELECT 1 FROM care_program WHERE tenant_id IS NULL AND code = 'athlete');

-- -----------------------------------------------------------------------------
-- 検査項目カタログ（現行 HTML の lab-* フィールドを網羅）
-- -----------------------------------------------------------------------------
INSERT INTO lab_test_catalog (code, name, unit, category, applies_to, sort_order) VALUES
  -- 血算
  ('hb',          'ヘモグロビン',     'g/dL',  '血算',     '{gyneco,athlete,general}', 10),
  ('mcv',         'MCV',              'fL',    '血算',     '{gyneco,athlete,general}', 11),
  -- 鉄関連
  ('ferritin',    'フェリチン',       'ng/mL', '鉄',       '{gyneco,athlete,general}', 20),
  ('fe',          '血清鉄',           'µg/dL', '鉄',       '{gyneco,athlete,general}', 21),
  -- 女性ホルモン（婦人科）
  ('e2',          'エストラジオール(E2)', 'pg/mL', 'ホルモン', '{gyneco}', 30),
  ('p4',          'プロゲステロン(P4)',   'ng/mL', 'ホルモン', '{gyneco}', 31),
  ('fsh',         'FSH',              'mIU/mL','ホルモン', '{gyneco}', 32),
  ('lh',          'LH',               'mIU/mL','ホルモン', '{gyneco}', 33),
  ('amh',         'AMH',              'ng/mL', 'ホルモン', '{gyneco}', 34),
  ('prl',         'プロラクチン',     'ng/mL', 'ホルモン', '{gyneco}', 35),
  -- 甲状腺
  ('tsh',         'TSH',              'µIU/mL','甲状腺',   '{gyneco,athlete,general}', 40),
  ('ft4',         'FT4',              'ng/dL', '甲状腺',   '{gyneco,general}', 41),
  -- 栄養・微量元素
  ('b12',         'ビタミンB12',      'pg/mL', '栄養',     '{gyneco,general}', 50),
  ('folate',      '葉酸',             'ng/mL', '栄養',     '{gyneco,general}', 51),
  ('vitd',        'ビタミンD',        'ng/mL', '栄養',     '{gyneco,athlete,general}', 52),
  ('zinc',        '亜鉛',             'µg/dL', '栄養',     '{gyneco,athlete,general}', 53),
  ('mg',          'マグネシウム',     'mg/dL', '栄養',     '{gyneco,general}', 54),
  -- アスリート系
  ('ck',          'CK（クレアチンキナーゼ）','U/L','筋','{athlete}', 60),
  ('ldh',         'LDH',              'U/L',   '筋',       '{athlete}', 61),
  ('ua',          '尿酸',             'mg/dL', '代謝',     '{athlete,general}', 62),
  ('testosterone','テストステロン',   'ng/mL', 'ホルモン', '{athlete}', 63),
  ('cortisol',    'コルチゾール',     'µg/dL', 'ホルモン', '{athlete}', 64),
  -- 炎症・代謝（共通）
  ('crp',         'CRP',              'mg/dL', '炎症',     '{gyneco,athlete,general}', 70),
  ('hba1c',       'HbA1c',            '%',     '代謝',     '{gyneco,athlete,general}', 71),
  ('glucose',     '血糖',             'mg/dL', '代謝',     '{gyneco,athlete,general}', 72),
  ('ldl',         'LDLコレステロール','mg/dL', '脂質',     '{gyneco,athlete,general}', 73),
  ('hdl',         'HDLコレステロール','mg/dL', '脂質',     '{gyneco,athlete,general}', 74)
ON CONFLICT (code) DO NOTHING;


-- ===== db/migrations/0002_review_refinements.sql =====

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


-- ===== db/migrations/0003_import_compat.sql =====

-- =============================================================================
-- 0003_import_compat.sql
-- Phase 2 インポータ実装中に判明した「既存データを失わないための」スキーマ補完。
-- 現行 総合カルテ(karte_state) は problem/soap に schema.sql 未対応の項目を持つ:
--   - problems[].category / diagnosis / onset
--   - soaps[].problemId （SOAP は visit ではなく problem にひも付く）
-- データ無損失のため列を追加する。詳細は docs/04-data-migration.md / docs/07。
-- =============================================================================

-- problem: 現行 karte の付加項目
ALTER TABLE problem ADD COLUMN IF NOT EXISTS category  text;
ALTER TABLE problem ADD COLUMN IF NOT EXISTS diagnosis text;
ALTER TABLE problem ADD COLUMN IF NOT EXISTS onset     text;

-- soap_note: problem へのひも付け（現行はSOAPがproblemに属する）
ALTER TABLE soap_note ADD COLUMN IF NOT EXISTS problem_id uuid REFERENCES problem(id);
CREATE INDEX IF NOT EXISTS idx_soap_problem ON soap_note(problem_id);

-- 取り込み元の生フィールドを保全する受け皿（未知項目を捨てない）
ALTER TABLE problem   ADD COLUMN IF NOT EXISTS source_ref jsonb;
ALTER TABLE soap_note ADD COLUMN IF NOT EXISTS source_ref jsonb;
ALTER TABLE visit     ADD COLUMN IF NOT EXISTS source_ref jsonb;


-- ===== db/migrations/supabase/0004_supabase_auth_rls.sql =====

-- =============================================================================
-- 0004_supabase_auth_rls.sql  ★Supabase 専用（auth スキーマが必要）
--
-- コアの 0001-0003 は「API が SET app.tenant_id を行う」GUC 方式（自前API向け）。
-- Supabase はクライアントから PostgREST 経由で接続するため、テナントを
-- ログインユーザー auth.uid() から解決する必要がある。本 migration で:
--   1. app_user に auth_user_id（auth.users 参照）を追加
--   2. app_current_tenant() … GUC があればそれ、無ければ auth.uid() から解決
--   3. tenant_isolation_* / parent_isolation_* を app_current_tenant() ベースへ置換
--
-- 適用順: 0001 → 0002 → 0003 → 0004（Supabase の SQL Editor / psql で実行）
-- 詳細: docs/setup/supabase-setup.md §3
-- =============================================================================

-- 1) Auth ユーザーとのひも付け
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_app_user_auth ON app_user(auth_user_id);

-- 2) 現在のテナント解決関数
--    - GUC(app.tenant_id) が設定されていれば優先（自前API/バッチ互換）
--    - 無ければログインユーザー(auth.uid())の所属テナント
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    (SELECT u.tenant_id FROM app_user u WHERE u.auth_user_id = auth.uid() LIMIT 1)
  );
$$;

-- 3) ポリシーを app_current_tenant() ベースへ置換
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
      USING (tenant_id = app_current_tenant())
      WITH CHECK (tenant_id = app_current_tenant());
    $p$, t);
  END LOOP;
END $$;

-- 子テーブル（親経由）
DROP POLICY IF EXISTS parent_isolation_gyneco_daily ON gyneco_daily;
DROP POLICY IF EXISTS parent_isolation_athlete_daily ON athlete_daily;
DROP POLICY IF EXISTS parent_isolation_selfcare_log ON selfcare_log;
DROP POLICY IF EXISTS parent_isolation_medication_log ON medication_log;
DROP POLICY IF EXISTS parent_isolation_visit_vital ON visit_vital;
DROP POLICY IF EXISTS parent_isolation_lab_value ON lab_value;

CREATE POLICY parent_isolation_gyneco_daily ON gyneco_daily USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = gyneco_daily.daily_record_id AND d.tenant_id = app_current_tenant()));
CREATE POLICY parent_isolation_athlete_daily ON athlete_daily USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = athlete_daily.daily_record_id AND d.tenant_id = app_current_tenant()));
CREATE POLICY parent_isolation_selfcare_log ON selfcare_log USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = selfcare_log.daily_record_id AND d.tenant_id = app_current_tenant()));
CREATE POLICY parent_isolation_medication_log ON medication_log USING (
  EXISTS (SELECT 1 FROM daily_record d
          WHERE d.id = medication_log.daily_record_id AND d.tenant_id = app_current_tenant()));
CREATE POLICY parent_isolation_visit_vital ON visit_vital USING (
  EXISTS (SELECT 1 FROM visit v
          WHERE v.id = visit_vital.visit_id AND v.tenant_id = app_current_tenant()));
CREATE POLICY parent_isolation_lab_value ON lab_value USING (
  EXISTS (SELECT 1 FROM lab_result r
          WHERE r.id = lab_value.lab_result_id AND r.tenant_id = app_current_tenant()));

-- authenticated ロールに必要権限を付与（PostgREST 経由のアクセス用）
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;


-- ===== db/migrations/supabase/0005_patient_portal.sql =====

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


-- ===== db/migrations/0006_intake_checks.sql =====

-- =============================================================================
-- 0006_intake_checks.sql
-- 問診チェックリスト（現行 personal-karte の CHECK_ITEMS）を保存する列を追加。
-- { "0": "はい", "1": "いいえ", ... } の形で patient_intake に保持する。
-- =============================================================================
ALTER TABLE patient_intake ADD COLUMN IF NOT EXISTS checks jsonb NOT NULL DEFAULT '{}'::jsonb;


-- ===== db/migrations/supabase/0007_patient_portal_extra.sql =====

-- =============================================================================
-- 0007_patient_portal_extra.sql  ★Supabase 専用
-- 患者本人が「自分の」トレーニング・食事・栄養目標を読み書きできるよう RLS を追加。
-- （0005 で daily_record 等は対応済み。本ファイルで training/food/nutrition を追加）
-- =============================================================================

-- トレーニング
DROP POLICY IF EXISTS training_self ON training_session;
CREATE POLICY training_self ON training_session
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());

-- 食事ログ
DROP POLICY IF EXISTS food_self ON food_entry;
CREATE POLICY food_self ON food_entry
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());

-- 栄養目標
DROP POLICY IF EXISTS nutrition_self ON nutrition_goal;
CREATE POLICY nutrition_self ON nutrition_goal
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());


-- ===== db/migrations/supabase/0008_patient_portal_more.sql =====

-- =============================================================================
-- 0008_patient_portal_more.sql  ★Supabase 専用
-- 患者本人が 服薬・採血・メディア を自分の分だけ読み書きできる RLS を追加。
-- （セルフケア selfcare_log は 0005 で対応済み）
-- =============================================================================

-- 服薬マスタ（患者本人）
DROP POLICY IF EXISTS medication_self ON medication;
CREATE POLICY medication_self ON medication
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());

-- 服薬実績（親 daily_record が本人）
DROP POLICY IF EXISTS medlog_self ON medication_log;
CREATE POLICY medlog_self ON medication_log
  USING (EXISTS (SELECT 1 FROM daily_record d WHERE d.id = medication_log.daily_record_id AND d.patient_id = app_current_patient()))
  WITH CHECK (EXISTS (SELECT 1 FROM daily_record d WHERE d.id = medication_log.daily_record_id AND d.patient_id = app_current_patient()));

-- 採血（患者本人）
DROP POLICY IF EXISTS lab_self ON lab_result;
CREATE POLICY lab_self ON lab_result
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());

DROP POLICY IF EXISTS lab_value_self ON lab_value;
CREATE POLICY lab_value_self ON lab_value
  USING (EXISTS (SELECT 1 FROM lab_result r WHERE r.id = lab_value.lab_result_id AND r.patient_id = app_current_patient()))
  WITH CHECK (EXISTS (SELECT 1 FROM lab_result r WHERE r.id = lab_value.lab_result_id AND r.patient_id = app_current_patient()));

-- メディア・添付（患者本人）
DROP POLICY IF EXISTS media_self ON media;
CREATE POLICY media_self ON media
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());

DROP POLICY IF EXISTS attachment_self ON attachment;
CREATE POLICY attachment_self ON attachment
  USING (patient_id = app_current_patient())
  WITH CHECK (patient_id = app_current_patient());


-- ===== db/migrations/supabase/0009_care_program_read.sql =====

-- =============================================================================
-- 0009_care_program_read.sql  ★Supabase 専用
-- ケアプログラム（婦人科/アスリート/総合）を選択・判定できるようにする RLS 修正。
--   - 標準プログラム（tenant_id IS NULL）は全テナント・全患者が参照可能にする
--     （0004 の tenant_isolation だと NULL 行が読めず、対象別カルテを判定できなかった）
--   - 患者は自分の patient_program を参照可能にする
-- =============================================================================

-- care_program: 参照は「標準(NULL) or 自テナント」、書き込みは自テナントのみ
DROP POLICY IF EXISTS tenant_isolation_care_program ON care_program;
DROP POLICY IF EXISTS care_program_select ON care_program;
CREATE POLICY care_program_select ON care_program FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = app_current_tenant());
DROP POLICY IF EXISTS care_program_write ON care_program;
CREATE POLICY care_program_write ON care_program FOR ALL
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

-- patient_program: 患者本人が自分の割当を参照可能（先生はtenant_isolationで参照可）
DROP POLICY IF EXISTS patient_program_self ON patient_program;
CREATE POLICY patient_program_self ON patient_program FOR SELECT
  USING (patient_id = app_current_patient());


-- ===== db/migrations/supabase/0010_karte_share.sql =====

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


-- ===== db/migrations/supabase/0011_appointments.sql =====

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


-- ===== db/migrations/supabase/0012_patient_sharing.sql =====

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


-- =============================================================================
-- 0013_appointment_location.sql  予約に施術場所(location)を追加
-- =============================================================================
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location text;

-- =============================================================================
-- 0014_patient_invite.sql  患者ログイン招待（URL方式）トークン
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
DROP POLICY IF EXISTS patient_invite_staff ON patient_invite;
CREATE POLICY patient_invite_staff ON patient_invite
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_invite TO authenticated;
