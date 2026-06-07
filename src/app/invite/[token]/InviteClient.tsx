'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

declare global {
  interface Window {
    liff?: {
      init: (c: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      getIDToken: () => string | null;
    };
  }
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

export function InviteClient({ token, patientName }: { token: string; patientName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function lineLogin() {
    if (!LIFF_ID) { setMsg('LINEログインが未設定です（NEXT_PUBLIC_LIFF_ID）。先生にご連絡ください。'); return; }
    setBusy(true); setMsg('LINEを準備中…');
    try {
      if (!window.liff) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('LIFF SDK の読み込みに失敗しました。'));
          document.body.appendChild(s);
        });
      }
      const liff = window.liff!;
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) { liff.login(); return; }
      const idToken = liff.getIDToken();
      if (!idToken) { setMsg('LINEのIDトークンを取得できませんでした。'); setBusy(false); return; }
      setMsg('連携中…');
      const res = await fetch('/api/invite/line', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, idToken }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error || '連携に失敗しました'); setBusy(false); return; }
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ email: json.email, token: json.otp, type: 'magiclink' });
      if (error) { setMsg('セッション確立に失敗しました：' + error.message); setBusy(false); return; }
      router.push('/today'); router.refresh();
    } catch (e) {
      setMsg('エラー：' + (e as Error).message); setBusy(false);
    }
  }

  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI へようこそ</h2>
        <p className="meta">{patientName} さんのアカウントを設定します。下のボタンからLINEで登録してください。</p>
        <button className="btn" style={{ width: '100%', background: '#06c755' }} onClick={lineLogin} disabled={busy}>
          LINEで登録・ログイン
        </button>
        {msg ? <p className="meta" style={{ marginTop: 10 }}>{msg}</p> : null}
      </div>
    </div>
  );
}
