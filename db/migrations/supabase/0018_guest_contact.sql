-- =============================================================================
-- 0018_guest_contact.sql  ★Supabase 専用
-- 公開予約（ゲスト）のふりがな・電話番号を構造化して保持。
-- 未適用でもアプリは動作（情報は notes に保存される）。
-- =============================================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS guest_kana  text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS guest_phone text;
