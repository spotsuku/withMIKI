'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

export function LineLinkButton({ linked }: { linked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function link() {
    if (!LIFF_ID) { setMsg('LINEログインが未設定です（NEXT_PUBLIC_LIFF_ID）。'); return; }
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
      const res = await fetch('/api/auth/line/link', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error || '連携に失敗しました'); setBusy(false); return; }
      setMsg('✅ LINEと連携しました。次回からLINEでログインできます。');
      setBusy(false);
      router.refresh();
    } catch (e) {
      setMsg('エラー：' + (e as Error).message); setBusy(false);
    }
  }

  return (
    <div>
      {linked ? (
        <p className="meta">✅ 連携済み。ログイン画面の「LINEでログイン」から入れます。</p>
      ) : (
        <p className="meta">連携すると、メール・パスワードの代わりにLINEでログインできます。</p>
      )}
      <button className="btn" style={{ background: '#06c755' }} onClick={link} disabled={busy}>
        {linked ? 'LINEを再連携' : 'LINEと連携する'}
      </button>
      {msg ? <p className="meta" style={{ marginTop: 8 }}>{msg}</p> : null}
    </div>
  );
}
