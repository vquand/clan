import { isClanData, type ClanData } from './clan-contract.ts';
import { getBrowserStorage, type StringStorage } from './local-storage.ts';

export const CLAN_DATA_CACHE_KEY = 'clan-data-cache-v1';

export function readCachedClanData(
  storage: StringStorage | null = getBrowserStorage(),
): ClanData | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(CLAN_DATA_CACHE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isClanData(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeCachedClanData(
  data: ClanData,
  storage: StringStorage | null = getBrowserStorage(),
) {
  if (!storage) return false;

  try {
    storage.setItem(CLAN_DATA_CACHE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
