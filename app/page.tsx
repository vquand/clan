import { ClanArchive } from '@/components/clan-archive';
import { loadClanData } from '@/lib/clan-data';

export const dynamic = 'force-static';

export default function Home() {
  const data = loadClanData();
  return <ClanArchive members={data.members} events={data.events} />;
}
