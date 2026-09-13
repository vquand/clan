export function normalizeSeedData(data, generateId) {
  const memberIds = new Map();
  const eventIds = new Map();
  const locationIds = new Map();

  for (const member of data.members) {
    if (memberIds.has(member.id)) {
      throw new Error(`Duplicate member import key: ${member.id}`);
    }
    if (!['lineage', 'marriage'].includes(member.clanRelation)) {
      throw new Error(
        `Member ${member.id} must declare clanRelation as lineage or marriage`,
      );
    }
    memberIds.set(member.id, generateId());
  }
  for (const event of data.events) {
    if (eventIds.has(event.id)) {
      throw new Error(`Duplicate event import key: ${event.id}`);
    }
    eventIds.set(event.id, generateId());
  }
  for (const location of data.locations ?? []) {
    if (locationIds.has(location.id)) {
      throw new Error(`Duplicate location import key: ${location.id}`);
    }
    locationIds.set(location.id, generateId());
  }

  const resolveMemberId = (importKey) => {
    const id = memberIds.get(importKey);
    if (!id) throw new Error(`Unknown member import key: ${importKey}`);
    return id;
  };
  const resolveLocationId = (importKey) => {
    const id = locationIds.get(importKey);
    if (!id) throw new Error(`Unknown location import key: ${importKey}`);
    return id;
  };

  const members = data.members.map((member) => ({
    id: resolveMemberId(member.id),
    full_name: member.fullName,
    familiar_name: member.familiarName,
    gender: member.gender,
    clan_relation: member.clanRelation,
    birth_year: member.birthYear,
    birth_date: member.birthDate,
    life_status: member.status,
    death_year: member.deathYear,
    death_date: member.deathDate,
    age_at_death: member.ageAtDeath,
    age_at_death_qualifier: member.ageAtDeathQualifier,
    age_group: member.ageGroup,
    avatar_style: member.avatarStyle ?? 'default',
    avatar_image_url: member.avatarImageUrl,
    death_anniversary_lunar_day: member.deathAnniversaryLunar?.day,
    death_anniversary_lunar_month: member.deathAnniversaryLunar?.month,
    hometown: member.hometown,
    residence: member.residence,
    biography: member.biography,
  }));

  const parents = data.members.flatMap((member) =>
    member.parentIds.map((parentImportKey, parentIndex) => ({
      child_id: resolveMemberId(member.id),
      parent_id: resolveMemberId(parentImportKey),
      parent_order: parentIndex + 1,
    })),
  );

  const spouseKeys = new Set();
  const spouses = [];
  for (const member of data.members) {
    for (const spouseImportKey of member.spouseIds) {
      const memberId = resolveMemberId(member.id);
      const spouseId = resolveMemberId(spouseImportKey);
      if (memberId === spouseId) {
        throw new Error(`Member cannot be their own spouse: ${member.id}`);
      }
      const [memberAId, memberBId] = [memberId, spouseId].sort((a, b) =>
        a.localeCompare(b),
      );
      const key = `${memberAId}:${memberBId}`;
      if (!spouseKeys.has(key)) {
        spouseKeys.add(key);
        spouses.push({ member_a_id: memberAId, member_b_id: memberBId });
      }
    }
  }

  const events = data.events.map((event) => ({
    id: eventIds.get(event.id),
    title: event.title,
    type: event.type,
    calendar: event.calendar,
    day: event.day,
    month: event.month,
    recurrence: event.recurrence,
    event_year: event.year,
    location: event.location,
    location_id: event.locationId ? resolveLocationId(event.locationId) : undefined,
    location_address: event.locationAddress,
    location_google_map_url: event.locationGoogleMapUrl,
    description: event.description,
  }));
  const locations = (data.locations ?? []).map((location) => ({
    id: locationIds.get(location.id),
    name: location.name,
    address: location.address ?? '',
    google_map_url: location.googleMapUrl,
  }));
  const eventMembers = data.events.flatMap((event) =>
    event.relatedMemberIds.map((memberImportKey) => ({
      event_id: eventIds.get(event.id),
      member_id: resolveMemberId(memberImportKey),
    })),
  );
  const eventSolarDates = data.events.flatMap((event) =>
    Object.entries(event.solarDates ?? {}).map(([year, solarDate]) => ({
      event_id: eventIds.get(event.id),
      year: Number(year),
      solar_date: solarDate,
    })),
  );

  return {
    members,
    parents,
    spouses,
    locations,
    events,
    eventMembers,
    eventSolarDates,
  };
}
