import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gia phả dòng họ',
  description:
    'Nơi lưu giữ thành viên, phả hệ và những ngày sum họp của gia đình.',
  icons: {
    icon: './clan-favicon.png',
    apple: './clan-emblem.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-reading-size="standard">
      <body>{children}</body>
    </html>
  );
}
