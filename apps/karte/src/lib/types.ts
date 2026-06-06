/** DB(schema.sql) に対応する最小型。MVP で使う範囲のみ定義。 */

export interface Patient {
  id: string;
  tenant_id: string;
  code: string | null;
  name: string;
  kana: string | null;
  dob: string | null;
  sex: string | null;
  blood_type: string | null;
  tel: string | null;
  email: string | null;
  address: string | null;
  job: string | null;
  first_visit_date: string | null;
  hospital: string | null;
  avatar: string | null;
  status: string;
  created_at: string;
}

export interface PatientIntake {
  patient_id: string;
  chief: string | null;
  onset: string | null;
  current: string | null;
  history: string | null;
  sleep: string | null;
  appetite: string | null;
  meds: string | null;
  note: string | null;
}

export interface KarteCover {
  patient_id: string;
  purpose: string | null;
  therapist: string | null;
  goal: string | null;
  diagnosis: string | null;
  treatment: string | null;
  caution: string | null;
  doctor: string | null;
  start_date: string | null;
  next_visit: string | null;
}

export interface Visit {
  id: string;
  patient_id: string;
  visit_date: string;
  injury_part: string | null;
  injury_name: string | null;
  points: string | null;
  technique: string | null;
  treatments: string[] | null;
  memo: string | null;
}

export interface Problem {
  id: string;
  patient_id: string;
  title: string;
  category: string | null;
  status: string;
  detail: string | null;
}

export interface LabResult {
  id: string;
  patient_id: string;
  taken_date: string;
  source: string;
  comment: string | null;
}

/** 年齢計算（dob から） */
export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
