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
