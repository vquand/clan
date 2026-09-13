import { ClanDataLoader } from '@/components/clan-data-loader';
import { loadClanData } from '@/lib/clan-data';
import { getClanDisplayName } from '@/lib/site-config';

export const dynamic = 'force-static';

export default function Home() {
  const remoteDataEnabled = Boolean(
    process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim(),
  );
  const clanDisplayName = getClanDisplayName();
  return (
    <ClanDataLoader
      clanDisplayName={clanDisplayName}
      sampleData={remoteDataEnabled ? null : loadClanData()}
      remoteDataEnabled={remoteDataEnabled}
    />
  );
}
