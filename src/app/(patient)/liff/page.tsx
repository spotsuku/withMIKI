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

export default function LiffPage() {
  const router = useRouter();
  const [status, setStatus] = useState('LINE ログインを準備中…');

  useEffect(() => {
    if (!LIFF_ID) { setStatus('LIFF が未設定です（NEXT_PUBLIC_LIFF_ID）。'); return; }
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.onload = async () => {
      try {
        const liff = window.liff!;
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const idToken = liff.getIDToken();
        if (!idToken) { setStatus('IDトークンを取得できませんでした。'); return; }
        setStatus('ログイン中…');
        const res = await fetch('/api/auth/line', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        const json = await res.json();
        if (!res.ok) { setStatus(json.error || 'ログインに失敗しました'); return; }
        const supabase = createClient();
        const { error } = await supabase.auth.verifyOtp({ email: json.email, token: json.otp, type: 'magiclink' });
        if (error) { setStatus('セッション確立に失敗しました：' + error.message); return; }
        router.push(json.role === 'staff' ? '/patients' : '/today');
        router.refresh();
      } catch (e) {
        setStatus('エラー：' + (e as Error).message);
      }
    };
    s.onerror = () => setStatus('LIFF SDK の読み込みに失敗しました。');
    document.body.appendChild(s);
  }, [router]);

  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI（LINE ログイン）</h2>
        <p className="meta">{status}</p>
      </div>
    </div>
  );
}
