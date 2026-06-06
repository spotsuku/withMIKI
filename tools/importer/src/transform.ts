import { detectSourceKind } from './detect.ts';
import { emptyImport, type NormalizedImport, type SourceKind } from './model.ts';
import { isObject } from './normalize.ts';
import { parseGynecoFull } from './parsers/gynecoFull.ts';
import { parseGynecoSummary } from './parsers/gynecoSummary.ts';
import { parseAthleteFull } from './parsers/athleteFull.ts';
import { parseKarteState } from './parsers/karteState.ts';

/**
 * 取り込み元 JSON を判定して正規化モデルへ変換する単一エントリポイント。
 * @param data  パース済み JSON
 * @param forceKind  自動判定を上書きしたい場合
 */
export function transform(data: unknown, forceKind?: SourceKind): NormalizedImport {
  const kind = forceKind ?? detectSourceKind(data);
  if (!isObject(data)) {
    const e = emptyImport('unknown', data);
    e.warnings.push('JSON がオブジェクトではありません');
    return e;
  }
  switch (kind) {
    case 'gyneco_full':
      return parseGynecoFull(data);
    case 'gyneco_summary':
      return parseGynecoSummary(data);
    case 'athlete_full':
      return parseAthleteFull(data);
    case 'karte_state':
      return parseKarteState(data);
    default: {
      const e = emptyImport('unknown', data);
      e.warnings.push('取り込み元の種別を判定できませんでした');
      return e;
    }
  }
}

/** 取り込み内容のサマリ（dry-run レポート用） */
export function summarize(n: NormalizedImport): Record<string, number | string> {
  const labValues = n.labResults.reduce((s, l) => s + l.values.length, 0);
  return {
    sourceKind: n.sourceKind,
    patient: n.patient.name,
    dailyRecords: n.dailyRecords.length,
    labResults: n.labResults.length,
    labValues,
    trainingSessions: n.trainingSessions.length,
    foodEntries: n.foodEntries.length,
    problems: n.problems.length,
    visits: n.visits.length,
    soaps: n.soaps.length,
    bodyDiagrams: n.bodyDiagrams.length,
    media: n.media.length,
    warnings: n.warnings.length,
  };
}
