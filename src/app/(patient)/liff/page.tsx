'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// LIFF SDK の最小型
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

function loadLiffSdk(): Promise<void> {
  if (window.liff) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('LIFF SDK の読み込みに失敗しました。'));
    document.body.appendChild(s);
  });
}

export default function LiffPage() {
  const router = useRouter();
  const [status, setStatus] = useState('LINE ログインを準備中…');
  const [notlinked, setNotlinked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();

        // 1) 既にログイン済みなら LINE を介さず即ロール振り分け（毎回ログインの高速化）
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { router.replace('/'); return; }

        // 2) LIFF でログイン
        if (!LIFF_ID) { setStatus('LIFF が未設定です（NEXT_PUBLIC_LIFF_ID）。'); return; }
        await loadLiffSdk();
        if (cancelled) return;
        const liff = window.liff!;
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; } // LINEへ遷移→戻ると再実行
        const idToken = liff.getIDToken();
        if (!idToken) { setStatus('IDトークンを取得できませんでした。'); return; }

        setStatus('ログイン中…');
        const res = await fetch('/api/auth/line', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        const json = await res.json();
        if (res.status === 404) { setNotlinked(true); setStatus(''); return; } // 未登録のLINE
        if (!res.ok) { setStatus(json.error || 'ログインに失敗しました'); return; }

        const { error } = await supabase.auth.verifyOtp({ email: json.email, token: json.otp, type: 'magiclink' });
        if (error) { setStatus('セッション確立に失敗しました：' + error.message); return; }
        router.replace(json.role === 'staff' ? '/patients' : '/today');
        router.refresh();
      } catch (e) {
        if (!cancelled) setStatus('エラー：' + (e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI（LINE ログイン）</h2>
        {notlinked ? (
          <>
            <p className="meta">このLINEアカウントはまだ登録されていません。</p>
            <p className="meta">初めての方は、先生から届いた<strong>招待URL</strong>から登録してください。登録済みの方は別のLINEでお試しください。</p>
            <a className="btn secondary" href="/login" style={{ width: '100%', textAlign: 'center', display: 'block' }}>ログイン画面へ</a>
          </>
        ) : (
          <p className="meta">{status}</p>
        )}
      </div>
    </div>
  );
}
