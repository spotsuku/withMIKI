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
INSERT INTO care_program (id, tenant_id, code, name, parent_id, record_kind, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'master',  '総合カルテ（共通基盤）', NULL, 'none', true)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO care_program (tenant_id, code, name, parent_id, record_kind, is_active) VALUES
  (NULL, 'gyneco',  '婦人科デイリーレコード',   '00000000-0000-0000-0000-000000000001', 'gyneco',  true),
  (NULL, 'athlete', 'アスリートレコード',       '00000000-0000-0000-0000-000000000001', 'athlete', true)
ON CONFLICT (tenant_id, code) DO NOTHING;

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
