/**
 * 正規化済みインポートモデル。
 * 現行 HTML(localStorage/JSON) を、DB(schema.sql) に近い構造へ変換した中間表現。
 * - DB 非依存（純粋な値）。FK の UUID は loader が採番してひも付ける。
 * - 1 患者分の取り込み内容を表す。
 */

export type SourceKind =
  | 'gyneco_full'
  | 'gyneco_summary'
  | 'athlete_full'
  | 'karte_state'
  | 'unknown';

export interface PatientCore {
  name: string;
  code?: string | null;
  kana?: string | null;
  dob?: string | null; // YYYY-MM-DD
  sex?: string | null;
  blood_type?: string | null;
  tel?: string | null;
  tel2?: string | null;
  email?: string | null;
  address?: string | null;
  job?: string | null;
  first_visit_date?: string | null;
  referrer?: string | null;
  route?: string | null;
  emergency_name?: string | null;
  emergency_rel?: string | null;
  emergency_tel?: string | null;
  hospital?: string | null;
  avatar?: string | null;
}

export interface IntakeRow {
  chief?: string | null;
  onset?: string | null;
  current?: string | null;
  history?: string | null;
  sleep?: string | null;
  appetite?: string | null;
  meds?: string | null;
  note?: string | null;
}

export interface CoverRow {
  purpose?: string | null;
  therapist?: string | null;
  goal?: string | null;
  diagnosis?: string | null;
  history?: string | null;
  treatment?: string | null;
  caution?: string | null;
  doctor?: string | null;
  start_date?: string | null;
  next_visit?: string | null;
}

export interface SelfcareLog {
  selfcare_code: string;
  done: boolean;
}

export interface MedicationLog {
  name: string;
  is_custom: boolean;
  taken: boolean;
}

export interface GynecoDaily {
  bbt?: number | null;
  cycle_day?: number | null;
  menstrual?: string | null;
  flow?: string | null;
  blood_state?: string[];
  discharge_amt?: string | null;
  discharge_state?: string[];
  cervical?: string | null;
  ov_test?: string | null;
  ov_pain?: string[];
  sex?: string | null;
  sex_note?: string[];
  breast?: string[];
  pms_physical?: string[];
  pms_mental?: string[];
  pain?: number | null;
  pain_location?: string[];
  chill_area?: string[];
  edema_area?: string[];
  tongue?: string[];
  oriental?: string[];
}

export interface AthleteDaily {
  injury?: string | null;
  condition_score?: number | null;
  extra?: Record<string, unknown>;
}

export interface DailyRecord {
  record_date: string; // YYYY-MM-DD
  weight?: number | null;
  body_fat?: number | null;
  muscle_mass?: number | null;
  height?: number | null;
  sbp?: number | null;
  dbp?: number | null;
  hr?: number | null;
  body_temp?: number | null;
  sleep_hours?: number | null;
  sleep_quality?: string | null;
  water?: number | null;
  exercise?: string | null;
  condition?: string | null;
  memo?: string | null;
  payload?: Record<string, unknown>;
  gyneco?: GynecoDaily;
  athlete?: AthleteDaily;
  selfcare?: SelfcareLog[];
  medications?: MedicationLog[];
}

export interface LabValue {
  test_code: string;
  value?: number | null;
  value_text?: string | null;
}

export interface LabResult {
  taken_date: string;
  source: 'manual' | 'ocr';
  comment?: string | null;
  values: LabValue[];
}

export interface TrainingSession {
  session_date: string;
  type?: string | null;
  duration_min?: number | null;
  intensity?: string | null;
  volume?: string | null;
  memo?: string | null;
}

export interface FoodEntry {
  entry_date: string;
  meal?: string | null;
  memo?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  ai_analysis?: unknown;
}

export interface NutritionGoal {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  target_weight?: number | null;
}

export interface ProblemRow {
  ref: string; // 元データ内のID（soap とのひも付けに使用）
  title: string;
  category?: string | null;
  diagnosis?: string | null;
  onset?: string | null;
  detail?: string | null;
  status?: string | null;
  source_ref?: Record<string, unknown>;
}

export interface SoapRow {
  problem_ref?: string | null; // ProblemRow.ref
  note_date: string;
  s?: string | null;
  o?: string | null;
  a?: string | null;
  p?: string | null;
}

export interface VisitRow {
  visit_date: string;
  injury_part?: string | null;
  injury_name?: string | null;
  disorder_part?: string | null;
  disorder_name?: string | null;
  points?: string | null;
  technique?: string | null;
  treatments?: string[];
  memo?: string | null;
  soap?: { s?: string; o?: string; a?: string; p?: string } | null;
  vital?: VisitVital | null;
}

export interface VisitVital {
  weight?: number | null;
  fat?: number | null;
  bmi?: number | null;
  temp?: number | null;
  sbp?: number | null;
  dbp?: number | null;
  hr?: number | null;
  spo2?: number | null;
  hb?: number | null;
  ht?: number | null;
  rbc?: number | null;
  mcv?: number | null;
  mch?: number | null;
  ferritin?: number | null;
  fe?: number | null;
  tibc?: number | null;
  tsat?: number | null;
  retic?: number | null;
  b12?: number | null;
  extra?: Record<string, number>;
}

export interface BodyDiagram {
  view: 'front' | 'back';
  marks: unknown[];
  note?: string | null;
}

export interface MediaRow {
  category?: string | null;
  title?: string | null;
  memo?: string | null;
  taken_date?: string | null;
}

export interface NormalizedImport {
  sourceKind: SourceKind;
  patient: PatientCore;
  intake?: IntakeRow;
  cover?: CoverRow;
  dailyRecords: DailyRecord[];
  labResults: LabResult[];
  trainingSessions: TrainingSession[];
  foodEntries: FoodEntry[];
  nutritionGoal?: NutritionGoal;
  problems: ProblemRow[];
  visits: VisitRow[];
  soaps: SoapRow[];
  bodyDiagrams: BodyDiagram[];
  media: MediaRow[];
  warnings: string[];
  /** 取り込み元 JSON 全体（監査・無損失のため保持） */
  raw: unknown;
}

export function emptyImport(sourceKind: SourceKind, raw: unknown): NormalizedImport {
  return {
    sourceKind,
    patient: { name: '' },
    dailyRecords: [],
    labResults: [],
    trainingSessions: [],
    foodEntries: [],
    problems: [],
    visits: [],
    soaps: [],
    bodyDiagrams: [],
    media: [],
    warnings: [],
    raw,
  };
}
