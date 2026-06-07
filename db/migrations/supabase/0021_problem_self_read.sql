-- =============================================================================
-- 0021_problem_self_read.sql  ★Supabase 専用
-- 患者が自分の問題リスト（problem）を閲覧できるようにする（基本カルテ表示用）。
-- =============================================================================

DROP POLICY IF EXISTS problem_self_select ON problem;
CREATE POLICY problem_self_select ON problem FOR SELECT
  USING (patient_id = app_current_patient());
