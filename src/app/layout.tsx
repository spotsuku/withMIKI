import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WithMIKI カルテ',
  description: 'WithMIKI 先生用カルテ Web',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
