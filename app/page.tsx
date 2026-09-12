import { ClanDataLoader } from '@/components/clan-data-loader';
import { loadClanData } from '@/lib/clan-data';

export const dynamic = 'force-static';

export default function Home() {
  const remoteDataEnabled = Boolean(
    process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim(),
  );
  return (
    <ClanDataLoader
      sampleData={remoteDataEnabled ? null : loadClanData()}
      remoteDataEnabled={remoteDataEnabled}
    />
  );
}
