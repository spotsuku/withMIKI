'use client';

import { useEffect } from 'react';

/**
 * ページ内エラー境界。従来はエラー時に白紙になっていたため、
 * 案内と「再読み込み」ボタンを表示して自力復帰できるようにする。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container login-wrap">
      <div className="card">
        <h2>ページを表示できませんでした</h2>
        <p className="meta">
          一時的なエラー、または更新前の古いデータが残っている可能性があります。
          再読み込みで直ることがほとんどです。
        </p>
        <button className="btn" style={{ width: '100%' }} onClick={() => reset()}>
          再試行
        </button>
        <button
          className="btn secondary"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => window.location.reload()}
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}
