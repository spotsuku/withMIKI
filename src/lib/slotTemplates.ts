/** 空き枠テンプレート定義（サーバーアクション外で共有） */
export interface SlotTemplate {
  name: string;
  weekdays: number[]; // 0=日..6=土
  start: string;      // HH:MM
  end: string;        // HH:MM
  interval: number;   // 分
}

export const DEFAULT_TEMPLATES: SlotTemplate[] = [
  { name: '平日 午前(9-12)', weekdays: [1, 2, 3, 4, 5], start: '09:00', end: '12:00', interval: 60 },
  { name: '平日 午後(14-18)', weekdays: [1, 2, 3, 4, 5], start: '14:00', end: '18:00', interval: 60 },
  { name: '土曜 終日(10-16)', weekdays: [6], start: '10:00', end: '16:00', interval: 60 },
];
