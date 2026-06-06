-- =============================================================================
-- 0006_intake_checks.sql
-- 問診チェックリスト（現行 personal-karte の CHECK_ITEMS）を保存する列を追加。
-- { "0": "はい", "1": "いいえ", ... } の形で patient_intake に保持する。
-- =============================================================================
ALTER TABLE patient_intake ADD COLUMN IF NOT EXISTS checks jsonb NOT NULL DEFAULT '{}'::jsonb;
