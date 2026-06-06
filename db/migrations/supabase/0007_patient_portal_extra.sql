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
