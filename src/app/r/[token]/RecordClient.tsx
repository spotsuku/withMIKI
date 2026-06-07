'use client';

import { useState } from 'react';
import { DailyForm, type DailyInitial } from '@/app/(patient)/today/DailyForm';
import { DiaryView } from '@/app/(patient)/diary/DiaryView';
import { BasicKarte, type BasicKarteData } from '@/components/BasicKarte';
import type { DiaryRow } from '@/lib/diaryCore';
import { SHARE_SECTIONS } from '@/lib/sections';
import { setRecordPin, verifyRecordPin, saveRecordByToken, linkLineFromRecord, saveShareByToken, addDiaryByToken, toggleDiaryByToken, deleteDiaryByToken } from './actions';

export function RecordClient({
  token, patientName, hasPin, initial, basicKarte, karteVisible, shared, diary,
}: {
  token: string; patientName: string; hasPin: boolean; initial: DailyInitial;
  basicKarte: BasicKarteData;
  karteVisible: Record<string, boolean>;
  shared: Record<string, boolean>;
  diary: DiaryRow[];
}) {
  const [phase, setPhase] = useState<'gate' | 'form'>('gate');
  const [tab, setTab] = useState<'karte' | 'mypage' | 'share'>('karte');
  const [setup] = useState(!hasPin);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<Record<string, boolean>>(
    Object.fromEntries(SHARE_SECTIONS.map((s) => [s.key, shared[s.key] ?? true])),
  );
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  async function saveShare() {
    setBusy(true);
    const r = await saveShareByToken(token, pinInput, share);
    setBusy(false);
    setShareMsg(r.error ? r.error : '✅ 公開設定を保存しました。');
  }

  async function doSetup() {
    if (pin.length < 4) { setMsg('PINは4桁以上で設定してください。'); return; }
    if (pin !== pin2) { setMsg('PIN（確認）が一致しません。'); return; }
    setBusy(true);
    const r = await setRecordPin(token, pin);
    setBusy(false);
    if (r.error) { setMsg(r.error); return; }
    setPinInput(pin); setPhase('form');
  }
  async function doVerify() {
    setBusy(true);
    const r = await verifyRecordPin(token, pinInput);
    setBusy(false);
    if (r.error) { setMsg(r.error); return; }
    setPhase('form');
  }
  async function switchToLine() {
    setBusy(true);
    const r = await linkLineFromRecord(token, pinInput);
    setBusy(false);
    if (r.error) { setMsg(r.error); return; }
    if (r.inviteToken) {
      sessionStorage.setItem('liff_mode', 'invite');
      sessionStorage.setItem('liff_token', r.inviteToken);
      window.location.href = '/liff';
    }
  }

  if (phase === 'gate') {
    return (
      <div className="container login-wrap">
        <div className="card">
          <h2>{patientName} さんの記録</h2>
          {setup ? (
            <>
              <p className="meta">はじめにPIN（暗証番号）を設定してください。次回からこのPINで開けます。</p>
              <div className="field"><label>PIN（4〜8桁）</label><input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} maxLength={8} /></div>
              <div className="field"><label>PIN（確認）</label><input type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} maxLength={8} /></div>
              {msg ? <p className="error">{msg}</p> : null}
              <button className="btn" style={{ width: '100%' }} onClick={doSetup} disabled={busy}>{busy ? '設定中…' : 'PINを設定して開く'}</button>
            </>
          ) : (
            <>
              <p className="meta">PIN（暗証番号）を入力してください。</p>
              <div className="field"><label>PIN</label><input type="password" inputMode="numeric" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} maxLength={8} /></div>
              {msg ? <p className="error">{msg}</p> : null}
              <button className="btn" style={{ width: '100%' }} onClick={doVerify} disabled={busy}>{busy ? '確認中…' : '開く'}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'karte', label: '🗂 カルテ' },
    { key: 'mypage', label: '🙂 マイページ' },
    { key: 'share', label: '🔒 公開設定' },
  ];

  return (
    <div className="container">
      <div className="topbar" style={{ borderRadius: 12, marginBottom: 0 }}>
        <span className="brand">WithMIKI<small>記録</small></span>
        <span className="meta">{patientName} さん</span>
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', padding: '8px 0' }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`btn${tab === t.key ? '' : ' secondary'}`}
            style={{ flex: 1, padding: '10px 4px', fontSize: 14 }}>{t.label}</button>
        ))}
      </div>

      {tab === 'karte' ? (
        <>
          {/* 基本カルテ（先生が記入・閲覧のみ） */}
          <p className="meta">先生が記入したあなたの基本カルテです（閲覧のみ）。</p>
          <BasicKarte data={basicKarte} visible={karteVisible} showHeader={false} />
          {!basicKarte.cover && !basicKarte.intake && !(basicKarte.problems && basicKarte.problems.length) && !(basicKarte.visits && basicKarte.visits.length) && !(basicKarte.labs && basicKarte.labs.length) ? (
            <div className="card"><div className="empty">公開されている内容はまだありません</div></div>
          ) : null}
        </>
      ) : null}

      {tab === 'mypage' ? (
        <>
          {/* 今日の記録（本人が記入） */}
          <p className="meta">体調や症状を記録できます。先生に見せる項目は「公開設定」タブで選べます。</p>
          <DailyForm initial={initial} action={saveRecordByToken} hidden={{ rt_token: token, rt_pin: pinInput }} />
          {/* 日記（エントリごとに公開/非公開） */}
          <DiaryView
            entries={diary}
            refreshOnChange={false}
            handlers={{
              onAdd: (fd) => addDiaryByToken(token, pinInput, fd),
              onToggle: (id, isShared) => toggleDiaryByToken(token, pinInput, id, isShared),
              onDelete: (id) => deleteDiaryByToken(token, pinInput, id),
            }}
          />
          <div className="card">
            <h2>LINEでログインに切り替える</h2>
            <p className="meta">アカウントを作ると、PIN無しでLINEからいつでも記録できます。</p>
            {msg ? <p className="error">{msg}</p> : null}
            <button className="btn" style={{ background: '#06c755' }} onClick={switchToLine} disabled={busy}>LINEに切り替える</button>
          </div>
        </>
      ) : null}

      {tab === 'share' ? (
        <div className="card">
          <h2>🔒 先生への公開設定</h2>
          <p className="meta">公開にした項目だけ、先生のカルテに表示されます。いつでも変更できます。</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {SHARE_SECTIONS.map((s) => (
              <label key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', borderBottom: '1px solid var(--line)' }}>
                <span>{s.label}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={share[s.key] ?? true} onChange={(e) => setShare((p) => ({ ...p, [s.key]: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                  <span className="meta">{(share[s.key] ?? true) ? '公開' : '非公開'}</span>
                </span>
              </label>
            ))}
          </div>
          {shareMsg ? <p className={shareMsg.startsWith('✅') ? 'meta' : 'error'}>{shareMsg}</p> : null}
          <div style={{ marginTop: 12 }}><button className="btn" onClick={saveShare} disabled={busy}>公開設定を保存</button></div>
        </div>
      ) : null}
    </div>
  );
}
