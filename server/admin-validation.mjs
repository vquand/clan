const genders = new Set(['male', 'female', 'other']);
const clanRelations = new Set(['lineage', 'marriage']);
const lifeStatuses = new Set(['living', 'deceased', 'unknown']);
const ageQualifiers = new Set(['exact', 'approximately', 'under']);
const ageGroups = new Set(['senior']);
const avatarStyles = new Set(['default', 'style-1', 'style-2', 'style-3']);
const eventTypes = new Set(['death-anniversary', 'clan-ceremony', 'gathering']);
const calendars = new Set(['solar', 'lunar']);
const recurrences = new Set(['annual', 'once']);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value, field, maxLength = 10000) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} is required`);
  }
  const result = value.trim();
  if (result.length > maxLength) throw new Error(`${field} is too long`);
  return result;
}

function optionalString(value, field, maxLength = 10000) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${field} must be text`);
  const result = value.trim();
  if (result.length > maxLength) throw new Error(`${field} is too long`);
  return result || null;
}

function optionalInteger(value, field, { min = 1, max = 9999 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const result = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(result) || result < min || result > max) {
    throw new Error(`${field} must be an integer from ${min} to ${max}`);
  }
  return result;
}

function optionalDate(value, field) {
  const result = optionalString(value, field, 10);
  if (result === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new Error(`${field} must be an ISO date`);
  }
  const date = new Date(`${result}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result) {
    throw new Error(`${field} must be a valid date`);
  }
  return result;
}

function optionalUrl(value, field) {
  const result = optionalString(value, field, 2_000);
  if (result === null) return null;
  let url;
  try {
    url = new URL(result);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${field} must use HTTP or HTTPS`);
  }
  return result;
}

function enumValue(value, field, allowed, defaultValue = null) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new Error(`${field} is invalid`);
  }
  return value;
}

function requiredEnumValue(value, field, allowed) {
  const result = enumValue(value, field, allowed);
  if (result === null) throw new Error(`${field} is required`);
  return result;
}

function booleanValue(value, field, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`);
  return value;
}

function normalizedIds(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${field} must be an array of IDs`);
  }
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function imageUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('avatarImageUrl must be text');
  const result = value.trim();
  if (result === '') return null;

  if (result.startsWith('data:')) {
    if (result.length > 24_000) {
      throw new Error('avatarImageUrl is too large');
    }
    if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(result)) {
      throw new Error('avatarImageUrl must be a compressed JPEG, PNG, or WebP data URL');
    }
    return result;
  }

  if (result.length > 2_000) throw new Error('avatarImageUrl is too long');
  if (!result.startsWith('/') && !/^https?:\/\//i.test(result)) {
    throw new Error('avatarImageUrl must be a local path or HTTP(S) URL');
  }
  return result;
}

export function normalizeMemberInput(input, { memberId } = {}) {
  if (!isRecord(input)) throw new Error('Member input must be an object');
  const parentIds = normalizedIds(input.parentIds, 'parentIds');
  const spouseIds = normalizedIds(input.spouseIds, 'spouseIds');
  if (memberId && [...parentIds, ...spouseIds].includes(memberId)) {
    throw new Error('A member cannot relate to itself');
  }

  const ageAtDeath = optionalInteger(input.ageAtDeath, 'ageAtDeath', {
    min: 0,
    max: 150,
  });
  const ageAtDeathQualifier = enumValue(
    input.ageAtDeathQualifier,
    'ageAtDeathQualifier',
    ageQualifiers,
  );
  if ((ageAtDeath === null) !== (ageAtDeathQualifier === null)) {
    throw new Error('ageAtDeath and ageAtDeathQualifier must be provided together');
  }

  const lunarDay = optionalInteger(
    input.deathAnniversaryLunarDay ?? input.deathAnniversaryLunar?.day,
    'deathAnniversaryLunarDay',
    { min: 1, max: 30 },
  );
  const lunarMonth = optionalInteger(
    input.deathAnniversaryLunarMonth ?? input.deathAnniversaryLunar?.month,
    'deathAnniversaryLunarMonth',
    { min: 1, max: 12 },
  );
  if ((lunarDay === null) !== (lunarMonth === null)) {
    throw new Error('Lunar anniversary day and month must be provided together');
  }

  const isClanHead = booleanValue(input.isClanHead, 'isClanHead');
  const isPreviousClanHead = booleanValue(
    input.isPreviousClanHead,
    'isPreviousClanHead',
  );
  if (isClanHead && isPreviousClanHead) {
    throw new Error('A member cannot be both current and previous clan head');
  }

  return {
    full_name: requiredString(input.fullName, 'fullName', 240),
    familiar_name: optionalString(input.familiarName, 'familiarName', 240),
    gender: requiredEnumValue(input.gender, 'gender', genders),
    clan_relation: requiredEnumValue(input.clanRelation, 'clanRelation', clanRelations),
    birth_year: optionalInteger(input.birthYear, 'birthYear'),
    birth_date: optionalDate(input.birthDate, 'birthDate'),
    sibling_order: optionalInteger(input.siblingOrder, 'siblingOrder'),
    life_status: enumValue(input.status, 'status', lifeStatuses),
    death_year: optionalInteger(input.deathYear, 'deathYear'),
    death_date: optionalDate(input.deathDate, 'deathDate'),
    age_at_death: ageAtDeath,
    age_at_death_qualifier: ageAtDeathQualifier,
    age_group: enumValue(input.ageGroup, 'ageGroup', ageGroups),
    avatar_style: enumValue(input.avatarStyle, 'avatarStyle', avatarStyles, 'default'),
    avatar_image_url: imageUrl(input.avatarImageUrl),
    is_clan_head: isClanHead,
    is_previous_clan_head: isPreviousClanHead,
    death_anniversary_lunar_day: lunarDay,
    death_anniversary_lunar_month: lunarMonth,
    hometown: optionalString(input.hometown, 'hometown'),
    residence: optionalString(input.residence, 'residence'),
    biography: optionalString(input.biography, 'biography', 20000),
    parentIds,
    spouseIds,
  };
}

export function normalizeSiblingOrderInput(input) {
  if (!isRecord(input)) throw new Error('Sibling order input must be an object');
  if (!Array.isArray(input.memberIds) || input.memberIds.length < 2) {
    throw new Error('memberIds must contain at least two members');
  }
  const memberIds = input.memberIds.map((memberId) => {
    if (typeof memberId !== 'string' || memberId.trim() === '') {
      throw new Error('memberIds must contain member IDs');
    }
    return memberId.trim();
  });
  if (new Set(memberIds).size !== memberIds.length) {
    throw new Error('memberIds must not contain duplicates');
  }
  return { memberIds };
}

export function reindexSiblingOrders(siblings, memberId, requestedOrder) {
  if (!Array.isArray(siblings) || siblings.length === 0) {
    throw new Error('Sibling group must contain at least one member');
  }
  if (typeof memberId !== 'string' || memberId.trim() === '') {
    throw new Error('Member ID is required for sibling reordering');
  }
  if (
    !Number.isInteger(requestedOrder) ||
    requestedOrder < 1 ||
    requestedOrder > siblings.length
  ) {
    throw new Error(`Sibling order must be from 1 to ${siblings.length}`);
  }

  const ids = siblings.map((member) => member.id);
  if (
    ids.some((id) => typeof id !== 'string' || id.trim() === '') ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error('Sibling group must contain unique member IDs');
  }

  const currentIndex = siblings.findIndex((member) => member.id === memberId);
  if (currentIndex === -1) throw new Error('Member is not in the sibling group');

  const hasCompleteSiblingOrder = siblings.every(
    (member) => member.siblingOrder !== undefined && member.siblingOrder !== null,
  );
  const ordered = [...siblings].sort((a, b) => {
    if (hasCompleteSiblingOrder && a.siblingOrder !== b.siblingOrder) {
      return a.siblingOrder - b.siblingOrder;
    }
    const aBirth =
      a.birthDate ??
      (a.birthYear === undefined
        ? undefined
        : `${a.birthYear.toString().padStart(4, '0')}-01-01`);
    const bBirth =
      b.birthDate ??
      (b.birthYear === undefined
        ? undefined
        : `${b.birthYear.toString().padStart(4, '0')}-01-01`);
    if (aBirth === undefined && bBirth !== undefined) return 1;
    if (aBirth !== undefined && bBirth === undefined) return -1;
    if (aBirth !== undefined && bBirth !== undefined && aBirth !== bBirth) {
      return aBirth.localeCompare(bBirth);
    }
    if (
      !hasCompleteSiblingOrder &&
      a.siblingOrder !== undefined &&
      a.siblingOrder !== null &&
      b.siblingOrder !== undefined &&
      b.siblingOrder !== null
    ) {
      const siblingComparison = a.siblingOrder - b.siblingOrder;
      if (siblingComparison !== 0) return siblingComparison;
    }
    return (
      (a.fullName ?? '').localeCompare(b.fullName ?? '') ||
      a.id.localeCompare(b.id)
    );
  });
  const movedMember = ordered.find((member) => member.id === memberId);
  if (!movedMember) throw new Error('Member is not in the sibling group');
  ordered.splice(ordered.indexOf(movedMember), 1);
  ordered.splice(requestedOrder - 1, 0, movedMember);

  return ordered.map((member, index) => ({
    id: member.id,
    siblingOrder: index + 1,
  }));
}

function normalizeSolarDates(value) {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new Error('solarDates must be an object');
  return Object.fromEntries(
    Object.entries(value).map(([year, date]) => {
      if (!/^\d{4}$/.test(year)) throw new Error('solarDates contains an invalid year');
      const normalizedDate = optionalDate(date, `solarDates.${year}`);
      if (normalizedDate === null) throw new Error(`solarDates.${year} is required`);
      return [Number(year), normalizedDate];
    }),
  );
}

export function normalizeLocationInput(input) {
  if (!isRecord(input)) throw new Error('Location input must be an object');
  return {
    name: requiredString(input.name, 'name', 240),
    address: optionalString(input.address, 'address', 500) ?? '',
    google_map_url: optionalUrl(input.googleMapUrl, 'googleMapUrl'),
  };
}

export function normalizeEventInput(input) {
  if (!isRecord(input)) throw new Error('Event input must be an object');
  const recurrence = requiredEnumValue(input.recurrence, 'recurrence', recurrences);
  const eventYear = optionalInteger(input.year ?? input.event_year, 'year');
  if (recurrence === 'once' && eventYear === null) {
    throw new Error('One-time events require a year');
  }
  const day = optionalInteger(input.day, 'day', { min: 1, max: 31 });
  const month = optionalInteger(input.month, 'month', { min: 1, max: 12 });
  if (day === null || month === null) throw new Error('day and month are required');
  const calendar = requiredEnumValue(input.calendar, 'calendar', calendars);
  if (calendar === 'lunar' && day > 30) {
    throw new Error('Lunar event days must be from 1 to 30');
  }
  const locationId = optionalString(input.locationId, 'locationId', 80);
  const locationName = optionalString(input.locationName, 'locationName', 240);
  const locationAddress = optionalString(input.locationAddress, 'locationAddress', 500);
  const locationGoogleMapUrl = optionalUrl(
    input.locationGoogleMapUrl,
    'locationGoogleMapUrl',
  );
  const saveLocation = booleanValue(input.saveLocation, 'saveLocation');
  if (saveLocation && (!locationName || locationId)) {
    throw new Error('A new location name is required when saving a location');
  }
  return {
    title: requiredString(input.title, 'title', 240),
    type: requiredEnumValue(input.type, 'type', eventTypes),
    calendar,
    day,
    month,
    recurrence,
    event_year: eventYear,
    relatedMemberIds: normalizedIds(input.relatedMemberIds, 'relatedMemberIds'),
    location: optionalString(input.location, 'location', 500) ?? '',
    location_id: locationId,
    location_name: locationName,
    location_address: locationAddress,
    location_google_map_url: locationGoogleMapUrl,
    save_location: saveLocation,
    description: optionalString(input.description, 'description', 20000),
    solarDates: normalizeSolarDates(input.solarDates),
  };
}

export function validateParentGraph(members) {
  const parentMap = new Map(members.map((member) => [member.id, member.parentIds ?? []]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error('Family relationships contain a parent cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const parentId of parentMap.get(id) ?? []) {
      if (parentMap.has(parentId)) visit(parentId);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const member of members) visit(member.id);
}
