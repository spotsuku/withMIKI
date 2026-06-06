'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function MediaUploadForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('patientId', patientId);
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('ファイルを選択してください。');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'アップロードに失敗しました');
      router.push(`/patients/${patientId}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="card">
        <h2>メディアの追加</h2>
        <div className="field">
          <label htmlFor="file">画像 / ファイル *</label>
          <input id="file" name="file" type="file" accept="image/*" capture="environment" required />
        </div>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="title">タイトル</label>
            <input id="title" name="title" />
          </div>
          <div className="field">
            <label htmlFor="category">分類</label>
            <input id="category" name="category" placeholder="例: 姿勢 / 患部 / フォーム" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="memo">メモ</label>
          <textarea id="memo" name="memo" rows={2} />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'アップロード中…' : 'アップロード'}
          </button>
          <Link className="btn secondary" href={`/patients/${patientId}`}>
            キャンセル
          </Link>
        </div>
        <p className="meta" style={{ marginTop: 8 }}>
          ※ 保存には Supabase Storage バケット <code>media</code> とサーバーの
          <code>SUPABASE_SERVICE_ROLE_KEY</code> が必要です（docs/setup/supabase-setup.md §5/§6）。
        </p>
      </div>
    </form>
  );
}
