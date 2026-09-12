import { clanEvents } from '../data/events.ts';
import { members } from '../data/members.ts';
import type { ClanEvent, Member } from '../data/types';
import { validateClanData } from './clan.ts';

export interface ClanData {
  members: Member[];
  events: ClanEvent[];
}

const MAX_DATA_BYTES = 60 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isMember(value: unknown): value is Member {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    ['male', 'female', 'other'].includes(String(value.gender)) &&
    Number.isInteger(value.generation) &&
    typeof value.branch === 'string' &&
    (value.birthYear === undefined || Number.isInteger(value.birthYear)) &&
    (value.status === undefined ||
      (typeof value.status === 'string' &&
        ['living', 'deceased'].includes(value.status))) &&
    isStringArray(value.parentIds) &&
    isStringArray(value.spouseIds)
  );
}

function isClanEvent(value: unknown): value is ClanEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    ['death-anniversary', 'clan-ceremony', 'gathering'].includes(
      String(value.type),
    ) &&
    ['solar', 'lunar'].includes(String(value.calendar)) &&
    Number.isInteger(value.day) &&
    Number.isInteger(value.month) &&
    ['annual', 'once'].includes(String(value.recurrence)) &&
    isStringArray(value.relatedMemberIds) &&
    typeof value.location === 'string'
  );
}

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

  if (!isRecord(parsed)) throw new Error('CLAN_DATA_JSON must be an object');
  if (!Array.isArray(parsed.members)) {
    throw new Error('CLAN_DATA_JSON members must be an array');
  }
  if (!Array.isArray(parsed.events)) {
    throw new Error('CLAN_DATA_JSON events must be an array');
  }
  if (!parsed.members.every(isMember)) {
    throw new Error('CLAN_DATA_JSON contains an invalid member');
  }
  if (!parsed.events.every(isClanEvent)) {
    throw new Error('CLAN_DATA_JSON contains an invalid event');
  }

  const data: ClanData = { members: parsed.members, events: parsed.events };
  const errors = validateClanData(data.members, data.events);
  if (errors.length > 0) {
    throw new Error(`CLAN_DATA_JSON failed validation:\n${errors.join('\n')}`);
  }
  return data;
}

export function loadClanData() {
  return resolveClanData(process.env.CLAN_DATA_JSON);
}
