'use client';

import { useState } from 'react';
import type { ChipGroup } from '@/lib/gyneco';

/**
 * チップ選択 UI。選択値を hidden input に反映してフォーム送信する。
 * single → name=`s_<key>`（文字列）, multi → name=`m_<key>`（JSON配列文字列）
 */
export function Chips({
  group,
  initialSingle,
  initialMulti,
}: {
  group: ChipGroup;
  initialSingle?: string | null;
  initialMulti?: string[] | null;
}) {
  const [single, setSingle] = useState<string>(initialSingle ?? '');
  const [multi, setMulti] = useState<string[]>(initialMulti ?? []);

  const toggle = (val: string) => {
    if (group.type === 'single') {
      setSingle((prev) => (prev === val ? '' : val));
    } else {
      setMulti((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
    }
  };

  const on = (val: string) => (group.type === 'single' ? single === val : multi.includes(val));

  return (
    <div className="field">
      <label>{group.label}</label>
      <div className="chips">
        {group.options.map(([val, lbl]) => (
          <button
            type="button"
            key={val}
            className={'chip' + (on(val) ? ' on' : '')}
            onClick={() => toggle(val)}
          >
            {lbl}
          </button>
        ))}
      </div>
      {group.type === 'single' ? (
        <input type="hidden" name={`s_${group.key}`} value={single} />
      ) : (
        <input type="hidden" name={`m_${group.key}`} value={JSON.stringify(multi)} />
      )}
    </div>
  );
}
