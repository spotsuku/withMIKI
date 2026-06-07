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

/**
 * LINE 処理の集約ページ（LIFFエンドポイントURLはここに設定）。
 * mode=login（既存ログイン）/ link（先生がLINE連携）/ invite（招待から患者登録）
 */
export default function LiffPage() {
  const router = useRouter();
  const [status, setStatus] = useState('LINE を準備中…');
  const [notlinked, setNotlinked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mode = sessionStorage.getItem('liff_mode') || 'login';
        const inviteToken = sessionStorage.getItem('liff_token') || '';
        const supabase = createClient();

        // ログイン目的で既にセッションがあれば即ロール振り分け（高速化）
        if (mode === 'login') {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) { router.replace('/'); return; }
        }

        if (!LIFF_ID) { setStatus('LIFF が未設定です（NEXT_PUBLIC_LIFF_ID）。'); return; }
        await loadLiffSdk();
        if (cancelled) return;
        const liff = window.liff!;
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; } // LINEへ→戻ると再実行（sessionStorageは保持）
        const idToken = liff.getIDToken();
        if (!idToken) { setStatus('IDトークンを取得できませんでした。'); return; }

        // idToken 期限切れ時：一度だけ再ログインして新しいトークンを取り直す
        const refreshLogin = () => {
          if (sessionStorage.getItem('liff_retried')) return false;
          sessionStorage.setItem('liff_retried', '1');
          setStatus('ログイン情報を更新中…');
          try { liff.logout(); } catch { /* noop */ }
          liff.login();
          return true;
        };
        const clearStorage = () => {
          sessionStorage.removeItem('liff_mode');
          sessionStorage.removeItem('liff_token');
          sessionStorage.removeItem('liff_retried');
        };

        // ---- 連携（先生がLINEをひも付け）----
        if (mode === 'link') {
          setStatus('連携中…');
          const res = await fetch('/api/auth/line/link', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }),
          });
          const j = await res.json();
          if (res.status === 401 && j.expired && refreshLogin()) return;
          if (!res.ok) { setStatus(j.error || '連携に失敗しました'); return; }
          clearStorage();
          router.replace('/settings?line=linked'); router.refresh();
          return;
        }

        // ---- 招待からの患者登録 ----
        if (mode === 'invite') {
          setStatus('登録中…');
          const res = await fetch('/api/invite/line', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: inviteToken, idToken }),
          });
          const j = await res.json();
          if (res.status === 401 && j.expired && refreshLogin()) return;
          if (!res.ok) { setStatus(j.error || '登録に失敗しました'); return; }
          const { error } = await supabase.auth.verifyOtp({ email: j.email, token: j.otp, type: 'magiclink' });
          if (error) { setStatus('セッション確立に失敗しました：' + error.message); return; }
          clearStorage();
          router.replace('/today'); router.refresh();
          return;
        }

        // ---- 通常ログイン ----
        setStatus('ログイン中…');
        const res = await fetch('/api/auth/line', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }),
        });
        const j = await res.json();
        if (res.status === 404) { setNotlinked(true); setStatus(''); return; }
        if (res.status === 401 && j.expired && refreshLogin()) return;
        if (!res.ok) { setStatus(j.error || 'ログインに失敗しました'); return; }
        const { error } = await supabase.auth.verifyOtp({ email: j.email, token: j.otp, type: 'magiclink' });
        if (error) { setStatus('セッション確立に失敗しました：' + error.message); return; }
        clearStorage();
        router.replace(j.role === 'staff' ? '/patients' : '/today'); router.refresh();
      } catch (e) {
        if (!cancelled) setStatus('エラー：' + (e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>WithMIKI（LINE）</h2>
        {notlinked ? (
          <>
            <p className="meta">このLINEアカウントはまだ登録されていません。</p>
            <p className="meta">初めての方は、先生から届いた<strong>招待URL</strong>から登録してください。</p>
            <a className="btn secondary" href="/login" style={{ width: '100%', textAlign: 'center', display: 'block' }}>ログイン画面へ</a>
          </>
        ) : (
          <p className="meta">{status}</p>
        )}
      </div>
    </div>
  );
}
