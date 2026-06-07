'use client';

import { DiaryView } from './DiaryView';
import type { DiaryRow } from '@/lib/diaryCore';
import { addDiaryEntry, toggleDiaryShare, removeDiaryEntry } from './actions';

export function DiaryClient({ entries }: { entries: DiaryRow[] }) {
  return (
    <DiaryView
      entries={entries}
      handlers={{
        onAdd: (fd) => addDiaryEntry({}, fd),
        onToggle: (id, isShared) => toggleDiaryShare(id, isShared),
        onDelete: (id) => removeDiaryEntry(id),
      }}
    />
  );
}
