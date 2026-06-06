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
