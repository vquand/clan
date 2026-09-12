import { ClanDataLoader } from '@/components/clan-data-loader';
import { loadClanData } from '@/lib/clan-data';

export const dynamic = 'force-static';

export default function Home() {
  const data = loadClanData();
  return <ClanDataLoader fallbackData={data} />;
}
