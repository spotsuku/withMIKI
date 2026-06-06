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
