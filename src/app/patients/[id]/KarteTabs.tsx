'use client';

import { useState } from 'react';

type TabKey = 'basic' | 'patient' | 'system';

export function KarteTabs({ basic, patient, system }: { basic: React.ReactNode; patient: React.ReactNode; system: React.ReactNode }) {
  const [tab, setTab] = useState<TabKey>('basic');
  const TABS: { k: TabKey; l: string }[] = [
    { k: 'basic', l: '🗂 基本カルテ' },
    { k: 'patient', l: '🙂 患者ページ' },
    { k: 'system', l: '⚙️ 予約・連携' },
  ];
  return (
    <>
      <div style={{ display: 'flex', gap: 6, position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg)', padding: '8px 0', marginBottom: 4 }}>
        {TABS.map((t) => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)}
            className={`btn${tab === t.k ? '' : ' secondary'}`}
            style={{ flex: 1, padding: '10px 4px' }}>{t.l}</button>
        ))}
      </div>
      <div style={{ display: tab === 'basic' ? 'block' : 'none' }}>{basic}</div>
      <div style={{ display: tab === 'patient' ? 'block' : 'none' }}>{patient}</div>
      <div style={{ display: tab === 'system' ? 'block' : 'none' }}>{system}</div>
    </>
  );
}
