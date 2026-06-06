/** 日時ユーティリティ（クリニックは JST 前提）。 */

const JST = 'Asia/Tokyo';

/** 日付(YYYY-MM-DD)＋時刻(HH:MM) を JST として ISO(UTC) に変換 */
export function jstToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

/** ISO に分を加算して ISO を返す */
export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

/** ISO を JST の "M/D(曜) HH:MM" で表示 */
export function fmtJst(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('ja-JP', { timeZone: JST, month: 'numeric', day: 'numeric', weekday: 'short' });
  const time = d.toLocaleTimeString('ja-JP', { timeZone: JST, hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

/** ISO を JST の "HH:MM" */
export function fmtTimeJst(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { timeZone: JST, hour: '2-digit', minute: '2-digit' });
}

/** ISO を JST の "YYYY-MM-DD" */
export function isoDateJst(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: JST }); // sv-SE = YYYY-MM-DD
}

/** 今日(JST)起点の week 日付配列（7日）。offsetWeeks で前後移動 */
export function weekDatesJst(offsetWeeks = 0): string[] {
  const now = new Date();
  const todayJst = new Date(now.toLocaleString('en-US', { timeZone: JST }));
  const dow = todayJst.getDay(); // 0=日
  const monday = new Date(todayJst);
  monday.setDate(todayJst.getDate() - ((dow + 6) % 7) + offsetWeeks * 7);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out.push(d.toLocaleDateString('sv-SE'));
  }
  return out;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: '申込',
  confirmed: '確定',
  cancelled: 'キャンセル',
};
