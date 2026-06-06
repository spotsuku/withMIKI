import {
  emptyImport,
  type NormalizedImport,
  type DailyRecord,
  type SelfcareLog,
  type MedicationLog,
} from '../model.ts';
import { num, int, str, arr, date, isObject, hasAnyValue } from '../normalize.ts';
import { labValuesFromObject, labComment } from './labs.ts';

/**
 * 婦人科 full（localStorage `db`）の取り込み。
 * 形: { records:{ 'YYYY-MM-DD': {...saveRecord...} }, settings:{patientName,patientId,height,cover}, customMeds:[] }
 */
export function parseGynecoFull(data: Record<string, unknown>): NormalizedImport {
  const out = emptyImport('gyneco_full', data);
  const settings = isObject(data.settings) ? data.settings : {};

  out.patient.name = str(settings.patientName) ?? '名称未設定';
  out.patient.code = str(settings.patientId);

  // 表紙 cover
  const cover = isObject(settings.cover) ? settings.cover : {};
  if (hasAnyValue(cover)) {
    out.cover = {
      purpose: str(cover.purpose),
      goal: str(cover.goal),
      diagnosis: str(cover.diagnosis),
      history: str(cover.history),
      treatment: str(cover.treatment),
      therapist: str(cover.therapist),
      doctor: str(cover.doctor),
      caution: str(cover.caution),
      start_date: date(cover.startdate),
      next_visit: date(cover.nextvisit),
    };
  }

  const records = isObject(data.records) ? data.records : {};
  const seenDates = new Set<string>();

  for (const [rawDate, rawRec] of Object.entries(records)) {
    if (!isObject(rawRec)) continue;
    const d = date(rawDate) ?? date(rawRec.date);
    if (!d) {
      out.warnings.push(`日付を解釈できないレコードをスキップ: ${rawDate}`);
      continue;
    }
    if (seenDates.has(d)) {
      out.warnings.push(`重複日(後勝ち): ${d}`);
    }
    seenDates.add(d);

    const rec = rawRec as Record<string, unknown>;
    const daily: DailyRecord = {
      record_date: d,
      weight: num(rec.weight),
      body_fat: num(rec.fat),
      height: num(rec.height) ?? num(settings.height),
      sbp: int(rec.sbp),
      dbp: int(rec.dbp),
      hr: int(rec.hr),
      body_temp: num(rec.bodytemp),
      sleep_hours: num(rec.sleep),
      sleep_quality: str(rec.sleepQuality),
      water: num(rec.water),
      exercise: str(rec.exercise),
      memo: str(rec.memo),
      gyneco: {
        bbt: num(rec.bbt),
        cycle_day: int(rec.cycleDay),
        menstrual: str(rec.menstrual),
        flow: str(rec.flow),
        blood_state: arr(rec.bloodState),
        discharge_amt: str(rec.dischargeAmt),
        discharge_state: arr(rec.dischargeState),
        cervical: str(rec.cervical),
        ov_test: str(rec.ovTest),
        ov_pain: arr(rec.ovPain),
        sex: str(rec.sex),
        sex_note: arr(rec.sexNote),
        breast: arr(rec.breast),
        pms_physical: arr(rec.pmsPhysical),
        pms_mental: arr(rec.pmsMental),
        pain: int(rec.pain),
        pain_location: arr(rec.painLocation),
        chill_area: arr(rec.chillArea),
        edema_area: arr(rec.edemaArea),
        tongue: arr(rec.tongue),
        oriental: arr(rec.oriental),
      },
      selfcare: parseSelfcare(rec.selfcare),
      medications: parseMeds(rec.meds, rec.customMeds),
    };
    out.dailyRecords.push(daily);

    // 採血（その日の lab）
    if (isObject(rec.lab)) {
      const values = labValuesFromObject(rec.lab);
      if (values.length > 0 || labComment(rec.lab)) {
        out.labResults.push({
          taken_date: d,
          source: 'manual',
          comment: labComment(rec.lab),
          values,
        });
      }
    }
  }

  out.dailyRecords.sort((a, b) => a.record_date.localeCompare(b.record_date));
  out.labResults.sort((a, b) => a.taken_date.localeCompare(b.taken_date));
  return out;
}

/** selfcare: 配列(コード列) or オブジェクト({code:bool}) の両対応 */
function parseSelfcare(v: unknown): SelfcareLog[] {
  if (Array.isArray(v)) {
    return v.map((c) => ({ selfcare_code: String(c), done: true }));
  }
  if (isObject(v)) {
    return Object.entries(v)
      .filter(([, done]) => done === true || done === 'true')
      .map(([code]) => ({ selfcare_code: code, done: true }));
  }
  return [];
}

/** meds(服用した薬名配列) + customMeds([{name,taken}]) → MedicationLog[] */
function parseMeds(meds: unknown, customMeds: unknown): MedicationLog[] {
  const out: MedicationLog[] = [];
  if (Array.isArray(meds)) {
    for (const m of meds) {
      const name = str(m);
      if (name) out.push({ name, is_custom: false, taken: true });
    }
  } else if (isObject(meds)) {
    for (const [name, taken] of Object.entries(meds)) {
      if (taken === true) out.push({ name, is_custom: false, taken: true });
    }
  }
  if (Array.isArray(customMeds)) {
    for (const cm of customMeds) {
      if (!isObject(cm)) continue;
      const name = str(cm.name);
      if (name) out.push({ name, is_custom: true, taken: cm.taken === true });
    }
  }
  return out;
}
