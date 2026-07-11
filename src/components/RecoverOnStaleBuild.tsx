'use client';

import { useEffect } from 'react';

const RELOAD_MARK = 'wm_stale_reload_at';
const RELOAD_COOLDOWN_MS = 60_000;

/** 古いビルドのチャンク読み込み失敗を示すメッセージか判定 */
function isChunkLoadError(message: string): boolean {
  return (
    /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      message,
    )
  );
}

/** 直近に自動リロード済みならスキップ（リロードループ防止） */
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_MARK) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(RELOAD_MARK, String(Date.now()));
  } catch {
    /* sessionStorage 不可でもリロード自体は行う */
  }
  window.location.reload();
}

/**
 * デプロイ直後や「ホーム画面に追加」したアプリで、キャッシュされた古いHTMLが
 * 削除済みのJSチャンク（/_next/static/...）を参照して読み込みに失敗すると、
 * 画面が白紙のまま止まる。これを検知して一度だけ自動再読み込みして復帰させる。
 */
export default function RecoverOnStaleBuild() {
  useEffect(() => {
    function onError(event: ErrorEvent | Event) {
      // <script src="/_next/..."> の読み込み失敗（404等）はリソースエラーとして届く
      const target = event.target as HTMLElement | null;
      if (target && target instanceof HTMLScriptElement) {
        const src = target.src || '';
        if (src.includes('/_next/')) reloadOnce();
        return;
      }
      const message = (event as ErrorEvent).message || '';
      if (isChunkLoadError(message)) reloadOnce();
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        typeof reason === 'string' ? reason : String(reason?.message ?? reason?.name ?? '');
      if (isChunkLoadError(message)) reloadOnce();
    }

    // リソースエラーは bubble しないため capture で拾う
    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
