'use client';

import { useState } from 'react';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export function KarteChat({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const message = input.trim();
    if (!message || loading) return;
    setError(null);
    setLoading(true);
    const newHistory = [...history, { role: 'user' as const, content: message }];
    setHistory(newHistory);
    setInput('');
    try {
      const res = await fetch('/api/ai/karte-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patientId, message, history }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'エラー');
      setHistory([...newHistory, { role: 'assistant', content: json.reply }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>AI カルテ補助</h2>
          <button className="btn secondary" onClick={() => setOpen(true)}>
            開く
          </button>
        </div>
        <p className="meta">この患者の文脈をもとに、施術方針や考えられる原因などを相談できます（参考情報）。</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>AI カルテ補助</h2>
        <button className="btn secondary" onClick={() => setOpen(false)}>
          閉じる
        </button>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {history.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: m.role === 'user' ? 'var(--accent-soft)' : '#fff',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '8px 12px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {m.content}
          </div>
        ))}
        {loading ? <p className="meta">考え中…</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <textarea
          rows={2}
          value={input}
          placeholder="例: この主訴で考えられる原因と施術方針は？"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send();
          }}
        />
      </div>
      <button className="btn" onClick={send} disabled={loading}>
        送信（⌘/Ctrl+Enter）
      </button>
      <p className="meta" style={{ marginTop: 8 }}>
        ※ AI の出力は参考情報です。診断は施術者がご判断ください。
      </p>
    </div>
  );
}
