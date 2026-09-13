import type { Metadata } from 'next';

import { AdminSpace } from '@/components/admin/admin-space';

export const metadata: Metadata = {
  title: 'Family archive admin',
  description: 'Private family archive administration workspace.',
};

export default function AdminPage() {
  return <AdminSpace />;
}
