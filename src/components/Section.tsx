'use client';

import { useState } from 'react';

/**
 * 折りたたみセクション。項目が増えても1画面が長くなりすぎないようにする。
 * 中身は閉じても DOM に残す（display:none）ので、フォーム値は保持・送信される。
 */
export function Section({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card acc">
      <button type="button" className="acc-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="acc-title">{title}{subtitle ? <span className="meta">　{subtitle}</span> : null}</span>
        <span className={'acc-caret' + (open ? ' open' : '')}>▾</span>
      </button>
      <div className="acc-body" style={{ display: open ? 'block' : 'none' }}>
        {children}
      </div>
    </div>
  );
}
