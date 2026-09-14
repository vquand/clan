import {
  MEMBER_AGE_GROUPS,
  MEMBER_AVATAR_STYLES,
  type ClanEvent,
  type ClanLocation,
  type Member,
} from '../data/types.ts';

export interface ClanData {
  members: Member[];
  events: ClanEvent[];
  locations?: ClanLocation[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export function isMember(value: unknown): value is Member {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    ['male', 'female', 'other'].includes(String(value.gender)) &&
    ['lineage', 'marriage'].includes(String(value.clanRelation)) &&
    Number.isInteger(value.generation) &&
    (value.branch === undefined || typeof value.branch === 'string') &&
    (value.birthYear === undefined || Number.isInteger(value.birthYear)) &&
    (value.siblingOrder === undefined ||
      (Number.isInteger(value.siblingOrder) && Number(value.siblingOrder) > 0)) &&
    (value.deathYear === undefined || Number.isInteger(value.deathYear)) &&
    (value.ageAtDeath === undefined ||
      (Number.isInteger(value.ageAtDeath) &&
        Number(value.ageAtDeath) >= 0 &&
        Number(value.ageAtDeath) <= 150)) &&
    (value.ageAtDeathQualifier === undefined ||
      (typeof value.ageAtDeathQualifier === 'string' &&
        ['exact', 'approximately', 'under'].includes(
          value.ageAtDeathQualifier,
        ))) &&
    (value.ageGroup === undefined ||
      MEMBER_AGE_GROUPS.includes(
        value.ageGroup as (typeof MEMBER_AGE_GROUPS)[number],
      )) &&
    (value.avatarStyle === undefined ||
      MEMBER_AVATAR_STYLES.includes(
        value.avatarStyle as (typeof MEMBER_AVATAR_STYLES)[number],
      )) &&
    (value.avatarImageUrl === undefined ||
      (typeof value.avatarImageUrl === 'string' &&
        value.avatarImageUrl.trim() !== '')) &&
    (value.isClanHead === undefined || typeof value.isClanHead === 'boolean') &&
    (value.isPreviousClanHead === undefined ||
      typeof value.isPreviousClanHead === 'boolean') &&
    (value.status === undefined ||
      (typeof value.status === 'string' &&
        ['living', 'deceased'].includes(value.status))) &&
    isStringArray(value.parentIds) &&
    isStringArray(value.spouseIds)
  );
}

export function isClanEvent(value: unknown): value is ClanEvent {
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
    typeof value.location === 'string' &&
    (value.locationId === undefined || typeof value.locationId === 'string') &&
    (value.locationAddress === undefined || typeof value.locationAddress === 'string') &&
    (value.locationGoogleMapUrl === undefined ||
      typeof value.locationGoogleMapUrl === 'string')
  );
}

export function isClanData(value: unknown): value is ClanData {
  return (
    isRecord(value) &&
    Array.isArray(value.members) &&
    value.members.every(isMember) &&
    Array.isArray(value.events) &&
    value.events.every(isClanEvent) &&
    (value.locations === undefined ||
      (Array.isArray(value.locations) &&
        value.locations.every((location) =>
          isRecord(location) &&
          typeof location.id === 'string' &&
          typeof location.name === 'string' &&
          typeof location.address === 'string' &&
          (location.googleMapUrl === undefined ||
            typeof location.googleMapUrl === 'string'),
        )))
  );
}
