import {
  emptyImport,
  type NormalizedImport,
  type VisitRow,
  type VisitVital,
} from '../model.ts';
import { num, int, str, date, arr, isObject, hasAnyValue } from '../normalize.ts';

/** visit_vital に型付き列を持つキー（それ以外は extra jsonb へ） */
const VITAL_COLS = new Set([
  'weight', 'fat', 'bmi', 'temp', 'sbp', 'dbp', 'hr', 'spo2',
  'hb', 'ht', 'rbc', 'mcv', 'mch', 'ferritin', 'fe', 'tibc', 'tsat', 'retic', 'b12',
]);

/** visit オブジェクト上で vital 以外の構造化キー（vital 抽出時に除外） */
const VISIT_STRUCT_KEYS = new Set([
  'id', 'date', 'treatments', 'soap', 'injury', 'points', 'tech', 'memo',
]);

/**
 * 総合カルテ（localStorage `state`）の取り込み。
 * 形: { patient, basicInfo, cover, visits:{id:{...}}, problems:[], soaps:[], bodyMarks:{front,back}, bodyNote, media }
 */
export function parseKarteState(data: Record<string, unknown>): NormalizedImport {
  const out = emptyImport('karte_state', data);
  const patient = isObject(data.patient) ? data.patient : {};
  const basic = isObject(data.basicInfo) ? data.basicInfo : {};

  // 患者基本情報（basicInfo 優先、無ければ patient.name）
  out.patient.name = str(basic.name) ?? str(patient.name) ?? '名称未設定';
  out.patient.code = str(patient.no);
  out.patient.kana = str(basic.kana);
  out.patient.dob = date(basic.dob);
  out.patient.sex = str(basic.sex);
  out.patient.blood_type = str(basic.blood);
  out.patient.tel = str(basic.tel);
  out.patient.tel2 = str(basic.tel2);
  out.patient.email = str(basic.email);
  out.patient.address = str(basic.address);
  out.patient.job = str(basic.job);
  out.patient.first_visit_date = date(basic.firstvisit);
  out.patient.referrer = str(basic.referrer);
  out.patient.route = str(basic.route);
  out.patient.emergency_name = str(basic.emname);
  out.patient.emergency_rel = str(basic.emrel);
  out.patient.emergency_tel = str(basic.emtel);
  out.patient.hospital = str(basic.hospital);
  out.patient.avatar = str(patient.avatar);

  // 問診
  const intake = {
    chief: str(basic.chief),
    onset: str(basic.onset),
    current: str(basic.current),
    history: str(basic.history),
    sleep: str(basic.sleep),
    appetite: str(basic.appetite),
    meds: str(basic.meds),
    note: str(basic.note),
  };
  if (hasAnyValue(intake)) out.intake = intake;

  // 表紙 cover
  const cover = isObject(data.cover) ? data.cover : {};
  if (hasAnyValue(cover)) {
    out.cover = {
      purpose: str(cover.purpose),
      goal: str(cover.goal),
      therapist: str(cover.therapist),
      diagnosis: str(cover.diagnosis),
      history: str(cover.history),
      treatment: str(cover.treatment),
      caution: str(cover.caution),
    };
  }

  // 問題リスト
  if (Array.isArray(data.problems)) {
    for (const p of data.problems) {
      if (!isObject(p)) continue;
      const title = str(p.title);
      if (!title) continue;
      out.problems.push({
        ref: str(p.id) ?? title,
        title,
        category: str(p.category),
        diagnosis: str(p.diagnosis),
        onset: str(p.onset),
        detail: str(p.note),
        status: str(p.status) ?? 'active',
        source_ref: p as Record<string, unknown>,
      });
    }
  }

  // SOAP（problemId にひも付く）
  if (Array.isArray(data.soaps)) {
    for (const sp of data.soaps) {
      if (!isObject(sp)) continue;
      const d = date(sp.date);
      if (!d) continue;
      out.soaps.push({
        problem_ref: str(sp.problemId),
        note_date: d,
        s: str(sp.s),
        o: str(sp.o),
        a: str(sp.a),
        p: str(sp.p),
      });
    }
  }

  // 施術記録 visits
  const visits = isObject(data.visits) ? data.visits : {};
  for (const [id, rawV] of Object.entries(visits)) {
    if (!isObject(rawV)) continue;
    const v = rawV as Record<string, unknown>;
    const d = date(v.date);
    const injury = isObject(v.injury) ? v.injury : {};
    const soap = isObject(v.soap) ? v.soap : null;

    const visit: VisitRow = {
      visit_date: d ?? '1970-01-01',
      injury_part: str(injury.injurypart),
      injury_name: str(injury.injuryname),
      disorder_part: str(injury.disorderpart),
      disorder_name: str(injury.disordername),
      points: str(v.points),
      technique: str(v.tech),
      treatments: arr(v.treatments),
      memo: str(v.memo),
      soap: soap
        ? { s: str(soap.s) ?? '', o: str(soap.o) ?? '', a: str(soap.a) ?? '', p: str(soap.p) ?? '' }
        : null,
      vital: extractVital(v),
    };
    if (!d) out.warnings.push(`visit(${id}) の日付が不明のため 1970-01-01 で取り込み`);
    out.visits.push(visit);
  }
  out.visits.sort((a, b) => a.visit_date.localeCompare(b.visit_date));

  // 人体図
  const marks = isObject(data.bodyMarks) ? data.bodyMarks : {};
  const bodyNote = str(data.bodyNote);
  for (const view of ['front', 'back'] as const) {
    const m = Array.isArray(marks[view]) ? (marks[view] as unknown[]) : [];
    if (m.length > 0 || bodyNote) {
      out.bodyDiagrams.push({ view, marks: m, note: bodyNote });
    }
  }

  // メディア
  if (Array.isArray(data.media)) {
    for (const m of data.media) {
      if (!isObject(m)) continue;
      out.media.push({
        category: str(m.cat) ?? str(m.category),
        title: str(m.title),
        memo: str(m.memo),
        taken_date: date(m.date),
      });
    }
  }

  return out;
}

/** visit から visit_vital を抽出（型付き列 + extra） */
function extractVital(v: Record<string, unknown>): VisitVital | null {
  const vital: VisitVital = {};
  const extra: Record<string, number> = {};
  let has = false;
  for (const [key, val] of Object.entries(v)) {
    if (VISIT_STRUCT_KEYS.has(key)) continue;
    const n = num(val);
    if (n === null) continue;
    has = true;
    if (VITAL_COLS.has(key)) {
      (vital as Record<string, number>)[key] = n;
    } else {
      extra[key] = n;
    }
  }
  if (Object.keys(extra).length > 0) vital.extra = extra;
  return has ? vital : null;
}
