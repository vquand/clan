import { isClanData, type ClanData } from './clan-contract.ts';

export function getClanApiEndpoint(remoteDataEnabled: boolean) {
  return remoteDataEnabled ? '/api/clan' : null;
}

export async function fetchClanData(
  endpoint: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ClanData> {
  const response = await fetcher(endpoint, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Clan API returned ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isClanData(data)) throw new Error('Clan API returned invalid data');
  return data;
}
