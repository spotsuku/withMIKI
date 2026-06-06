import { emptyImport, type NormalizedImport } from '../model.ts';
import { str, date, isObject, hasAnyValue } from '../normalize.ts';
import { labValuesFromObject, labComment } from './labs.ts';

/**
 * 婦人科サマリー（exportSummaryJSON の出力）の取り込み。
 * 形: { patientName, patientId, cover:{}, latestLab:{date, ...labfields}, stats:{}, exportedAt }
 * 全履歴は含まないため、最新採血と表紙のみ取り込む（docs/04 §2.2）。
 */
export function parseGynecoSummary(data: Record<string, unknown>): NormalizedImport {
  const out = emptyImport('gyneco_summary', data);

  out.patient.name = str(data.patientName) ?? '名称未設定';
  out.patient.code = str(data.patientId);

  const cover = isObject(data.cover) ? data.cover : {};
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

  const latest = isObject(data.latestLab) ? data.latestLab : null;
  if (latest) {
    const d = date(latest.date) ?? date(data.exportedAt);
    const values = labValuesFromObject(latest);
    if (d && (values.length > 0 || labComment(latest))) {
      out.labResults.push({
        taken_date: d,
        source: 'manual',
        comment: labComment(latest),
        values,
      });
    } else if (!d && values.length > 0) {
      out.warnings.push('最新採血の日付が不明のため取り込みをスキップしました');
    }
  }

  out.warnings.push('サマリー形式: 日次の全履歴は含まれません（最新採血と表紙のみ取り込み）');
  return out;
}
