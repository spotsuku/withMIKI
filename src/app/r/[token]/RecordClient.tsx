'use client';

import { useState } from 'react';
import { DailyForm, type DailyInitial } from '@/app/(patient)/today/DailyForm';
import { setRecordPin, verifyRecordPin, saveRecordByToken, linkLineFromRecord } from './actions';

export function RecordClient({
  token, patientName, hasPin, initial,
}: {
  token: string; patientName: string; hasPin: boolean; initial: DailyInitial;
}) {
  const [phase, setPhase] = useState<'gate' | 'form'>('gate');
  const [setup] = useState(!hasPin);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="container">
      <div className="topbar" style={{ borderRadius: 12, marginBottom: 12 }}>
        <span className="brand">WithMIKI<small>記録</small></span>
        <span className="meta">{patientName} さん</span>
      </div>
      <p className="meta">記録は先生のカルテに反映されます（先生の記入内容は上書きされません）。</p>
      <DailyForm initial={initial} action={saveRecordByToken} hidden={{ rt_token: token, rt_pin: pinInput }} />
      <div className="card">
        <h2>LINEでログインに切り替える</h2>
        <p className="meta">アカウントを作ると、PIN無しでLINEからいつでも記録できます。</p>
        {msg ? <p className="error">{msg}</p> : null}
        <button className="btn" style={{ background: '#06c755' }} onClick={switchToLine} disabled={busy}>LINEに切り替える</button>
      </div>
    </div>
  );
}
