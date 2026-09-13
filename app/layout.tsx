import type { Metadata } from 'next';
import './globals.css';
import { getClanDisplayName } from '@/lib/site-config';

const clanDisplayName = getClanDisplayName();

export const metadata: Metadata = {
  title: clanDisplayName ? `Họ ${clanDisplayName}` : 'Gia phả dòng họ',
  description: clanDisplayName
    ? `Gia phả, thành viên và những ngày sum họp của họ ${clanDisplayName}.`
    : 'Nơi lưu giữ thành viên, phả hệ và những ngày sum họp của gia đình.',
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
