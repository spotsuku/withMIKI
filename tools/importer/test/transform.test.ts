import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transform } from '../src/transform.ts';

function fx(name: string): unknown {
  const p = fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(p, 'utf-8'));
}

test('gyneco_full: patient, cover, records, lab, selfcare, meds', () => {
  const n = transform(fx('gyneco_full'));
  assert.equal(n.sourceKind, 'gyneco_full');
  assert.equal(n.patient.name, 'テスト花子');
  assert.equal(n.patient.code, 'P-0001');
  assert.equal(n.cover?.diagnosis, '月経前症候群');
  assert.equal(n.cover?.start_date, '2026-01-10'); // 2026/01/10 → 正規化
  // bad-date はスキップされ 2 件
  assert.equal(n.dailyRecords.length, 2);
  const day1 = n.dailyRecords[0];
  assert.equal(day1.record_date, '2026-01-10');
  assert.equal(day1.gyneco?.bbt, 36.45);
  assert.deepEqual(day1.gyneco?.blood_state, ['sticky', 'clot']);
  assert.equal(day1.height, 160); // settings.height 補完
  // selfcare 配列
  assert.deepEqual(day1.selfcare?.map((s) => s.selfcare_code), ['iap', 'pelvic']);
  // meds + customMeds
  const medNames = day1.medications?.map((m) => m.name);
  assert.ok(medNames?.includes('葉酸'));
  assert.ok(medNames?.includes('オリジナル漢方'));
  assert.equal(day1.medications?.find((m) => m.name === 'オリジナル漢方')?.is_custom, true);
  // selfcare object 形式（day2）
  const day2 = n.dailyRecords[1];
  assert.deepEqual(day2.selfcare?.map((s) => s.selfcare_code), ['iap']); // walk=false は除外
  // lab
  assert.equal(n.labResults.length, 1);
  assert.equal(n.labResults[0].taken_date, '2026-01-10');
  assert.equal(n.labResults[0].comment, '貧血傾向'); // other → comment
  const hb = n.labResults[0].values.find((v) => v.test_code === 'hb');
  assert.equal(hb?.value, 11.2);
  // 警告: bad-date
  assert.ok(n.warnings.some((w) => w.includes('bad-date')));
});

test('athlete_full: records, trainings, food, labs, media, goal', () => {
  const n = transform(fx('athlete_full'));
  assert.equal(n.sourceKind, 'athlete_full');
  assert.equal(n.patient.name, 'テスト太郎');
  assert.equal(n.patient.dob, '2008-04-01');
  assert.equal(n.dailyRecords.length, 1);
  assert.equal(n.dailyRecords[0].muscle_mass, 52.1);
  assert.equal(n.dailyRecords[0].athlete?.injury, '右膝に違和感');
  assert.equal(n.trainingSessions.length, 2);
  assert.equal(n.trainingSessions[0].duration_min, 90);
  assert.equal(n.nutritionGoal?.calories, 2800);
  assert.equal(n.nutritionGoal?.target_weight, 62);
  assert.equal(n.foodEntries.length, 1);
  assert.equal(n.foodEntries[0].protein, 30);
  assert.equal(n.labResults.length, 1);
  const ck = n.labResults[0].values.find((v) => v.test_code === 'ck');
  assert.equal(ck?.value, 320);
  const testo = n.labResults[0].values.find((v) => v.test_code === 'testosterone');
  assert.equal(testo?.value, 5.2);
  assert.equal(n.media.length, 1);
  assert.equal(n.media[0].title, '走りの動画');
});

test('karte_state: patient, intake, cover, problems, soaps, visits, body, media', () => {
  const n = transform(fx('karte_state'));
  assert.equal(n.sourceKind, 'karte_state');
  assert.equal(n.patient.name, 'テスト次郎');
  assert.equal(n.patient.code, 'P12345');
  assert.equal(n.patient.email, 'test@example.com');
  assert.equal(n.intake?.chief, '腰痛');
  assert.equal(n.intake?.note, '妊娠中ではない');
  assert.equal(n.cover?.diagnosis, '筋筋膜性腰痛');
  // problems
  assert.equal(n.problems.length, 1);
  assert.equal(n.problems[0].ref, 'prob_1');
  assert.equal(n.problems[0].category, '運動器');
  assert.equal(n.problems[0].detail, '前屈で痛み'); // note → detail
  // soaps linked to problem
  assert.equal(n.soaps.length, 1);
  assert.equal(n.soaps[0].problem_ref, 'prob_1');
  // visits sorted (v_2 has no date → 1970 first)
  assert.equal(n.visits.length, 2);
  const dated = n.visits.find((v) => v.visit_date === '2026-02-01');
  assert.ok(dated);
  assert.deepEqual(dated?.treatments, ['鍼', '灸']);
  assert.equal(dated?.points, '腎兪・大腸兪');
  assert.equal(dated?.soap?.o, 'L4/5圧痛');
  // vital: typed cols + extra
  assert.equal(dated?.vital?.weight, 68);
  assert.equal(dated?.vital?.hb, 15.1);
  assert.equal(dated?.vital?.extra?.tsh, 1.8); // tsh は extra へ
  assert.equal(dated?.vital?.extra?.vitd, 28);
  // body diagram (front has marks, back empty but bodyNote present → both)
  assert.ok(n.bodyDiagrams.length >= 1);
  assert.equal(n.bodyDiagrams.find((b) => b.view === 'front')?.note, '腰部に圧痛点');
  // media
  assert.equal(n.media.length, 1);
  // warning for visit without date
  assert.ok(n.warnings.some((w) => w.includes('日付が不明')));
});

test('gyneco_summary: cover + latest lab only', () => {
  const n = transform(fx('gyneco_summary'));
  assert.equal(n.sourceKind, 'gyneco_summary');
  assert.equal(n.patient.name, 'テスト花子');
  assert.equal(n.dailyRecords.length, 0);
  assert.equal(n.labResults.length, 1);
  assert.equal(n.labResults[0].taken_date, '2026-01-10');
  assert.equal(n.cover?.goal, 'PMS軽減');
  assert.ok(n.warnings.some((w) => w.includes('サマリー')));
});

test('unknown source produces warning, no throw', () => {
  const n = transform({ hello: 'world' });
  assert.equal(n.sourceKind, 'unknown');
  assert.ok(n.warnings.length > 0);
});

test('raw is preserved for audit', () => {
  const raw = fx('gyneco_full');
  const n = transform(raw);
  assert.equal(n.raw, raw);
});
