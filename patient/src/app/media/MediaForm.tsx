'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function MediaForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) { setError('ファイルを選択してください。'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'アップロードに失敗しました');
      router.push('/media');
      router.refresh();
    } catch (e) { setError((e as Error).message); setLoading(false); }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="card">
        <h2>写真・メディアを追加</h2>
        <div className="field"><label htmlFor="file">画像 *</label><input id="file" name="file" type="file" accept="image/*" required /></div>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="title">タイトル</label><input id="title" name="title" /></div>
          <div className="field"><label htmlFor="category">分類</label><input id="category" name="category" placeholder="例: 体調 / 患部" /></div>
        </div>
        <div className="field"><label htmlFor="memo">メモ</label><input id="memo" name="memo" /></div>
        {error ? <p className="error">{error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'アップロード中…' : 'アップロード'}</button>
          <Link className="btn secondary" href="/today">キャンセル</Link>
        </div>
      </div>
    </form>
  );
}
