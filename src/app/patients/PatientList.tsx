'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ageFromDob, type Patient } from '@/lib/types';

export function PatientList({ patients }: { patients: Patient[] }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return patients;
    return patients.filter((p) => {
      const hay = [p.name, p.kana, p.code].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(kw);
    });
  }, [q, patients]);

  return (
    <>
      <div className="search-wrap">
        <input
          type="search"
          className="search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前・カナ・カルテNo. で検索"
          aria-label="患者を検索"
        />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        {patients.length === 0 ? (
          <div className="empty">
            患者がまだいません。既存データは <code>tools/importer</code> で取り込めます。
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">「{q}」に一致する患者は見つかりませんでした。</div>
        ) : (
          <ul className="patient-list">
            {filtered.map((p) => {
              const age = ageFromDob(p.dob);
              return (
                <li key={p.id}>
                  <Link href={`/patients/${p.id}`}>
                    <span className="code-badge">{p.code ? `No.${p.code}` : '未番'}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      {p.kana ? <span className="meta">　{p.kana}</span> : null}
                      <br />
                      <span className="meta">
                        {p.sex ?? ''}
                        {age !== null ? `${p.sex ? '　' : ''}${age}歳` : ''}
                      </span>
                    </span>
                    <span className="meta">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
