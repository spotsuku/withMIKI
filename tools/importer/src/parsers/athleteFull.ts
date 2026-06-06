import {
  emptyImport,
  type NormalizedImport,
  type DailyRecord,
} from '../model.ts';
import { num, int, str, date, isObject, hasAnyValue } from '../normalize.ts';
import { labValuesFromObject, labComment } from './labs.ts';

/**
 * アスリート full（exportData の出力 = db 全体）の取り込み。
 * 形: { records:{date:{weight,fat,muscle,hr,sleep,height,condition,injury,memo}},
 *       settings:{height,sport,category,weightRestriction},
 *       trainings:[{date,type,duration,intensity,volume,memo}],
 *       foodEntries:[{date,type,photo,analysis,memo}],
 *       labHistory:[{date,comment,...labs}],
 *       mediaEntries:[{cat,date,title,memo,files}],
 *       cover:{name,sport,team,dob,goal}, foodGoals:{calories,protein,carbs,weight} }
 */
export function parseAthleteFull(data: Record<string, unknown>): NormalizedImport {
  const out = emptyImport('athlete_full', data);
  const settings = isObject(data.settings) ? data.settings : {};
  const cover = isObject(data.cover) ? data.cover : {};

  out.patient.name = str(cover.name) ?? '名称未設定';
  out.patient.dob = date(cover.dob);

  // 表紙: goal は karte_cover。sport/team は athlete 文脈として cover.goal にまとめず保持
  if (hasAnyValue(cover)) {
    out.cover = {
      goal: str(cover.goal),
    };
  }

  // デイリー records
  const records = isObject(data.records) ? data.records : {};
  for (const [rawDate, rawRec] of Object.entries(records)) {
    if (!isObject(rawRec)) continue;
    const d = date(rawDate) ?? date(rawRec.date);
    if (!d) {
      out.warnings.push(`日付を解釈できないレコードをスキップ: ${rawDate}`);
      continue;
    }
    const rec = rawRec as Record<string, unknown>;
    const daily: DailyRecord = {
      record_date: d,
      weight: num(rec.weight),
      body_fat: num(rec.fat),
      muscle_mass: num(rec.muscle),
      height: num(rec.height) ?? num(settings.height),
      hr: int(rec.hr),
      sleep_hours: num(rec.sleep),
      condition: str(rec.condition),
      memo: str(rec.memo),
      athlete: {
        injury: str(rec.injury),
        condition_score: int(rec.conditionScore),
      },
    };
    out.dailyRecords.push(daily);
  }
  out.dailyRecords.sort((a, b) => a.record_date.localeCompare(b.record_date));

  // トレーニング
  if (Array.isArray(data.trainings)) {
    for (const t of data.trainings) {
      if (!isObject(t)) continue;
      const d = date(t.date);
      if (!d) continue;
      out.trainingSessions.push({
        session_date: d,
        type: str(t.type),
        duration_min: int(t.duration),
        intensity: str(t.intensity),
        volume: str(t.volume),
        memo: str(t.memo),
      });
    }
  }

  // 栄養目標
  if (isObject(data.foodGoals)) {
    const g = data.foodGoals;
    out.nutritionGoal = {
      calories: num(g.calories),
      protein: num(g.protein),
      carbs: num(g.carbs),
      fat: num(g.fat),
      target_weight: num(g.weight),
    };
  }

  // 食事ログ
  if (Array.isArray(data.foodEntries)) {
    for (const f of data.foodEntries) {
      if (!isObject(f)) continue;
      const d = date(f.date);
      if (!d) continue;
      const analysis = isObject(f.analysis) ? f.analysis : {};
      out.foodEntries.push({
        entry_date: d,
        meal: str(f.type),
        memo: str(f.memo),
        calories: num(analysis.calories),
        protein: num(analysis.protein),
        carbs: num(analysis.carbs),
        fat: num(analysis.fat),
        ai_analysis: hasAnyValue(analysis) ? analysis : undefined,
      });
    }
  }

  // 採血履歴
  if (Array.isArray(data.labHistory)) {
    for (const lab of data.labHistory) {
      if (!isObject(lab)) continue;
      const d = date(lab.date);
      if (!d) continue;
      const values = labValuesFromObject(lab);
      if (values.length > 0 || labComment(lab)) {
        out.labResults.push({
          taken_date: d,
          source: 'manual',
          comment: labComment(lab),
          values,
        });
      }
    }
    out.labResults.sort((a, b) => a.taken_date.localeCompare(b.taken_date));
  }

  // メディア
  if (Array.isArray(data.mediaEntries)) {
    for (const m of data.mediaEntries) {
      if (!isObject(m)) continue;
      out.media.push({
        category: str(m.cat),
        title: str(m.title),
        memo: str(m.memo),
        taken_date: date(m.date),
      });
    }
  }

  return out;
}
