import { clanEvents } from '../data/events.ts';
import { members } from '../data/members.ts';
import { validateClanData } from './clan.ts';
import {
  isClanData,
  isClanEvent,
  isMember,
  type ClanData,
} from './clan-contract.ts';

export type { ClanData } from './clan-contract.ts';

const MAX_DATA_BYTES = 60 * 1024;

export function resolveClanData(rawData?: string): ClanData {
  if (!rawData?.trim()) return { members, events: clanEvents };

  if (Buffer.byteLength(rawData, 'utf8') > MAX_DATA_BYTES) {
    throw new Error('CLAN_DATA_JSON exceeds the supported 60 KB limit');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    throw new Error('CLAN_DATA_JSON must contain valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CLAN_DATA_JSON must be an object');
  }
  const candidate = parsed as Record<string, unknown>;
  if (!Array.isArray(candidate.members)) {
    throw new Error('CLAN_DATA_JSON members must be an array');
  }
  if (!Array.isArray(candidate.events)) {
    throw new Error('CLAN_DATA_JSON events must be an array');
  }
  if (!candidate.members.every(isMember)) {
    throw new Error('CLAN_DATA_JSON contains an invalid member');
  }
  if (!candidate.events.every(isClanEvent)) {
    throw new Error('CLAN_DATA_JSON contains an invalid event');
  }

  const data: ClanData = {
    members: candidate.members,
    events: candidate.events,
  };
  if (!isClanData(data)) {
    throw new Error('CLAN_DATA_JSON contains invalid clan data');
  }
  const errors = validateClanData(data.members, data.events);
  if (errors.length > 0) {
    throw new Error(`CLAN_DATA_JSON failed validation:\n${errors.join('\n')}`);
  }
  return data;
}

export function loadClanData() {
  return resolveClanData(process.env.CLAN_DATA_JSON);
}
