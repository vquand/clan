import { ClanDataLoader } from '@/components/clan-data-loader';
import { loadClanData } from '@/lib/clan-data';
import { getClanDisplayName } from '@/lib/site-config';

export const dynamic = 'force-static';

export default function Home() {
  const remoteDataEnabled = process.env.CLAN_DEMO !== 'true';
  const clanDisplayName = getClanDisplayName();
  return (
    <ClanDataLoader
      clanDisplayName={clanDisplayName}
      sampleData={remoteDataEnabled ? null : loadClanData()}
      remoteDataEnabled={remoteDataEnabled}
    />
  );
}
