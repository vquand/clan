import type { Metadata, Viewport } from 'next';
import { PwaRegister } from '@/components/pwa-register';
import './globals.css';
import { getClanDisplayName } from '@/lib/site-config';

const clanDisplayName = getClanDisplayName();

export const metadata: Metadata = {
  title: clanDisplayName ? `Họ ${clanDisplayName}` : 'Gia phả dòng họ',
  description: clanDisplayName
    ? `Gia phả, thành viên và những ngày sum họp của họ ${clanDisplayName}.`
    : 'Nơi lưu giữ thành viên, phả hệ và những ngày sum họp của gia đình.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: {
      url: '/icons/apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png',
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: clanDisplayName ? `Họ ${clanDisplayName}` : 'Gia phả dòng họ',
  },
  formatDetection: { telephone: false },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#7c2d1e',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-reading-size="standard">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
