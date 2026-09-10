import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gia phả dòng họ',
  description:
    'Nơi lưu giữ thành viên, phả hệ và những ngày sum họp của gia đình.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
