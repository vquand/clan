function asNumber(value) {
  return value === null || value === undefined ? undefined : Number(value);
}

function asDate(value) {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function assignGenerations(memberIds, parentRows, spouseRows) {
  const generations = new Map(memberIds.map((id) => [id, 0]));
  const maxPasses = Math.max(1, memberIds.length * 2);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;

    for (const row of parentRows) {
      const parentGeneration = generations.get(String(row.parent_id));
      const childId = String(row.child_id);
      const childGeneration = generations.get(childId);
      if (parentGeneration === undefined || childGeneration === undefined)
        continue;
      const nextGeneration = Math.max(childGeneration, parentGeneration + 1);
      if (nextGeneration !== childGeneration) {
        generations.set(childId, nextGeneration);
        changed = true;
      }
    }

    for (const row of spouseRows) {
      const memberAId = String(row.member_a_id);
      const memberBId = String(row.member_b_id);
      const memberAGeneration = generations.get(memberAId);
      const memberBGeneration = generations.get(memberBId);
      if (memberAGeneration === undefined || memberBGeneration === undefined)
        continue;
      const sharedGeneration = Math.max(memberAGeneration, memberBGeneration);
      if (memberAGeneration !== sharedGeneration) {
        generations.set(memberAId, sharedGeneration);
        changed = true;
      }
      if (memberBGeneration !== sharedGeneration) {
        generations.set(memberBId, sharedGeneration);
        changed = true;
      }
    }

    if (!changed) return generations;
  }

  throw new Error('Family relationships contain a parent cycle');
}

function compact(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

export function assembleClanData({
  memberRows,
  parentRows,
  spouseRows,
  eventRows,
  eventMemberRows,
  eventSolarDateRows,
}) {
  const memberIds = memberRows.map((row) => String(row.id));
  const generations = assignGenerations(memberIds, parentRows, spouseRows);
  const parentsByMember = new Map(memberIds.map((id) => [id, []]));
  const spousesByMember = new Map(memberIds.map((id) => [id, []]));

  for (const row of parentRows) {
    parentsByMember.get(String(row.child_id))?.push(String(row.parent_id));
  }
  for (const row of spouseRows) {
    const memberAId = String(row.member_a_id);
    const memberBId = String(row.member_b_id);
    spousesByMember.get(memberAId)?.push(memberBId);
    spousesByMember.get(memberBId)?.push(memberAId);
  }

  const members = memberRows.map((row) => {
    const id = String(row.id);
    const lunarDay = asNumber(row.death_anniversary_lunar_day);
    const lunarMonth = asNumber(row.death_anniversary_lunar_month);
    return compact({
      id,
      fullName: row.full_name,
      familiarName: row.familiar_name ?? undefined,
      gender: row.gender,
      generation: generations.get(id) ?? 0,
      birthYear: asNumber(row.birth_year),
      birthDate: asDate(row.birth_date),
      status: row.life_status ?? undefined,
      deathDate: asDate(row.death_date),
      deathAnniversaryLunar:
        lunarDay !== undefined && lunarMonth !== undefined
          ? { day: lunarDay, month: lunarMonth }
          : undefined,
      parentIds: parentsByMember.get(id) ?? [],
      spouseIds: spousesByMember.get(id) ?? [],
      hometown: row.hometown ?? undefined,
      residence: row.residence ?? undefined,
      biography: row.biography ?? undefined,
    });
  });

  const relatedMembersByEvent = new Map(
    eventRows.map((row) => [String(row.id), []]),
  );
  for (const row of eventMemberRows) {
    relatedMembersByEvent
      .get(String(row.event_id))
      ?.push(String(row.member_id));
  }

  const solarDatesByEvent = new Map(
    eventRows.map((row) => [String(row.id), {}]),
  );
  for (const row of eventSolarDateRows) {
    const solarDates = solarDatesByEvent.get(String(row.event_id));
    if (solarDates) solarDates[Number(row.year)] = asDate(row.solar_date);
  }

  const events = eventRows.map((row) => {
    const id = String(row.id);
    const solarDates = solarDatesByEvent.get(id) ?? {};
    return compact({
      id,
      title: row.title,
      type: row.type,
      calendar: row.calendar,
      day: Number(row.day),
      month: Number(row.month),
      recurrence: row.recurrence,
      year: asNumber(row.event_year),
      relatedMemberIds: relatedMembersByEvent.get(id) ?? [],
      location: row.location,
      description: row.description ?? undefined,
      solarDates: Object.keys(solarDates).length > 0 ? solarDates : undefined,
    });
  });

  return { members, events };
}
