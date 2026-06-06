import type { SourceKind } from './model.ts';
import { isObject } from './normalize.ts';

/**
 * 取り込み元 JSON の種別を自動判定する。
 * 判定キーは docs/04-data-migration.md §1 に対応。
 */
export function detectSourceKind(data: unknown): SourceKind {
  if (!isObject(data)) return 'unknown';

  // karte_state: 総合カルテ localStorage state
  if (isObject(data.visits) && (isObject(data.basicInfo) || isObject(data.patient))) {
    return 'karte_state';
  }

  // athlete_full: アスリート db（trainings / foodGoals を持つ）
  if (Array.isArray(data.trainings) || isObject(data.foodGoals)) {
    return 'athlete_full';
  }

  // gyneco_full: 婦人科 db（records がオブジェクトで婦人科項目を含む）
  if (isObject(data.records)) {
    const first = Object.values(data.records as Record<string, unknown>)[0];
    if (isObject(first) && ('menstrual' in first || 'bbt' in first)) {
      return 'gyneco_full';
    }
    // records はあるが婦人科判定キーが無い場合も婦人科 db とみなす
    return 'gyneco_full';
  }

  // gyneco_summary: 婦人科 exportSummaryJSON（patientName + latestLab + cover）
  if ('patientName' in data && ('latestLab' in data || 'cover' in data)) {
    return 'gyneco_summary';
  }

  return 'unknown';
}
