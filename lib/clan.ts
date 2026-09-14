import type { ClanEvent, Member } from '../data/types';
import { type Locale, translate } from './i18n.ts';
import { getSolarDateFromLunar } from './lunar-calendar.ts';

export { getLunarDate, getSolarDateFromLunar } from './lunar-calendar.ts';

export function getMember(id: string, allMembers: Member[]) {
  return allMembers.find((member) => member.id === id);
}

const coupleGenderOrder: Record<Member['gender'], number> = {
  male: 0,
  female: 1,
  other: 2,
};

export function orderCoupleMembers(member: Member): [Member];
export function orderCoupleMembers(
  member: Member,
  spouse: Member,
): [Member, Member];
export function orderCoupleMembers(
  member: Member,
  spouse: Member | undefined,
): [Member, Member?];
export function orderCoupleMembers(
  member: Member,
  spouse?: Member,
): [Member, Member?] {
  if (!spouse) return [member];

  return coupleGenderOrder[member.gender] <= coupleGenderOrder[spouse.gender]
    ? [member, spouse]
    : [spouse, member];
}

function compareBirthInformation(a: Member, b: Member) {
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
  if (aBirth === undefined && bBirth === undefined) return 0;
  if (aBirth === undefined) return 1;
  if (bBirth === undefined) return -1;
  return aBirth.localeCompare(bBirth);
}

export function orderMembersBySiblingOrder(siblings: Member[]) {
  const hasCompleteSiblingOrder =
    siblings.length > 1 &&
    siblings.every((member) => member.siblingOrder !== undefined);

  return [...siblings].sort((a, b) => {
    if (hasCompleteSiblingOrder && a.siblingOrder !== b.siblingOrder) {
      return a.siblingOrder! - b.siblingOrder!;
    }

    const birthComparison = compareBirthInformation(a, b);
    if (birthComparison !== 0) return birthComparison;

    if (a.siblingOrder !== undefined && b.siblingOrder !== undefined) {
      const siblingComparison = a.siblingOrder - b.siblingOrder;
      if (siblingComparison !== 0) return siblingComparison;
    }
    return a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id);
  });
}

export function getChildren(id: string, allMembers: Member[]) {
  return orderMembersBySiblingOrder(
    allMembers.filter((member) => member.parentIds.includes(id)),
  );
}

export function getSiblings(id: string, allMembers: Member[]) {
  const member = getMember(id, allMembers);
  if (!member || member.parentIds.length === 0) return [];

  const parentIds = new Set(member.parentIds);
  return orderMembersBySiblingOrder(
    allMembers.filter(
      (candidate) =>
        candidate.id === id ||
        candidate.parentIds.some((parentId) => parentIds.has(parentId)),
    ),
  );
}

export function getRelatives(member: Member, allMembers: Member[]) {
  const parents = member.parentIds
    .map((id) => getMember(id, allMembers))
    .filter((related): related is Member => Boolean(related))
    .sort(
      (a, b) =>
        coupleGenderOrder[a.gender] - coupleGenderOrder[b.gender] ||
        a.fullName.localeCompare(b.fullName) ||
        a.id.localeCompare(b.id),
    );
  const siblings = getSiblings(member.id, allMembers).filter(
    (related) => related.id !== member.id,
  );
  const children = getChildren(member.id, allMembers);
  const childrenAndSpouses = children.flatMap((child) => [
    child,
    ...child.spouseIds
      .map((id) => getMember(id, allMembers))
      .filter((related): related is Member => Boolean(related)),
  ]);
  const spouses = member.spouseIds
    .map((id) => getMember(id, allMembers))
    .filter((related): related is Member => Boolean(related));

  const ordered = [...parents, ...spouses, ...siblings, ...childrenAndSpouses];
  const seen = new Set<string>();
  return ordered.filter((related) => {
    if (related.id === member.id || seen.has(related.id)) return false;
    seen.add(related.id);
    return true;
  });
}

export function describeRelationship(
  selected: Member,
  related: Member,
  allMembers: Member[],
  locale: Locale = 'vi',
) {
  if (selected.spouseIds.includes(related.id)) {
    return translate(
      locale,
      related.gender === 'female' ? 'relationshipWife' : 'relationshipHusband',
    );
  }
  if (selected.parentIds.includes(related.id)) {
    return translate(
      locale,
      related.gender === 'female' ? 'relationshipMother' : 'relationshipFather',
    );
  }
  if (related.parentIds.includes(selected.id)) {
    return translate(
      locale,
      related.gender === 'female' ? 'relationshipDaughter' : 'relationshipSon',
    );
  }
  const sharedParent = selected.parentIds.some((id) =>
    related.parentIds.includes(id),
  );
  if (sharedParent) {
    return translate(
      locale,
      related.gender === 'female'
        ? 'relationshipSister'
        : 'relationshipBrother',
    );
  }
  return allMembers.some(
    (member) =>
      member.parentIds.includes(selected.id) &&
      member.spouseIds.includes(related.id),
  )
    ? translate(locale, 'relationshipChildInLaw')
    : translate(locale, 'relationshipRelative');
}

export function getEventDate(event: ClanEvent, year: number) {
  if (event.recurrence === 'once' && event.year !== year) return null;
  if (event.calendar === 'lunar') {
    return (
      event.solarDates?.[year] ??
      getSolarDateFromLunar({ year, month: event.month, day: event.day })
    );
  }
  const month = String(event.month).padStart(2, '0');
  const day = String(event.day).padStart(2, '0');
  return `${event.year ?? year}-${month}-${day}`;
}

export const moonPhases = [
  'new',
  'waxing-crescent',
  'first-quarter',
  'waxing-gibbous',
  'full',
  'waning-gibbous',
  'last-quarter',
  'waning-crescent',
] as const;

export type MoonPhase = (typeof moonPhases)[number];

export function getMoonPhase(lunarDay: number): MoonPhase {
  const day = Math.max(1, Math.min(30, Math.round(lunarDay)));
  if (day === 1 || day >= 29) return 'new';
  if (day <= 15) {
    const index = Math.min(4, Math.round(((day - 1) / 14) * 4));
    return moonPhases[index];
  }

  const index = 4 + Math.min(3, Math.round(((day - 15) / 13) * 3));
  return moonPhases[index];
}

export interface CalendarDay {
  date: Date;
  inMonth: boolean;
}

export function buildCalendarDays(
  year: number,
  monthIndex: number,
): CalendarDay[] {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const mondayOffset = (first.getDay() + 6) % 7;
  const days: CalendarDay[] = [];
  const cursor = new Date(year, monthIndex, 1 - mondayOffset);

  do {
    days.push({
      date: new Date(cursor),
      inMonth: cursor.getMonth() === monthIndex,
    });
    cursor.setDate(cursor.getDate() + 1);
  } while (cursor <= last || cursor.getDay() !== 1 || days.length < 35);

  return days;
}

export function validateClanData(allMembers: Member[], events: ClanEvent[]) {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const member of allMembers) {
    if (ids.has(member.id)) errors.push(`Mã thành viên bị trùng: ${member.id}`);
    ids.add(member.id);
  }

  for (const member of allMembers) {
    for (const relationId of [...member.parentIds, ...member.spouseIds]) {
      if (!ids.has(relationId)) {
        errors.push(
          `${member.id} tham chiếu thành viên không tồn tại: ${relationId}`,
        );
      }
      if (relationId === member.id)
        errors.push(`${member.id} tự tham chiếu chính mình`);
    }
    for (const spouseId of member.spouseIds) {
      const spouse = getMember(spouseId, allMembers);
      if (spouse && !spouse.spouseIds.includes(member.id)) {
        errors.push(
          `Quan hệ vợ/chồng không đối xứng: ${member.id} ↔ ${spouseId}`,
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visitParents(memberId: string) {
    if (visiting.has(memberId)) {
      errors.push(`Vòng lặp trong quan hệ cha mẹ tại: ${memberId}`);
      return;
    }
    if (visited.has(memberId)) return;
    visiting.add(memberId);
    const member = getMember(memberId, allMembers);
    member?.parentIds.forEach((parentId) => {
      if (ids.has(parentId)) visitParents(parentId);
    });
    visiting.delete(memberId);
    visited.add(memberId);
  }
  allMembers.forEach((member) => visitParents(member.id));

  for (const event of events) {
    for (const memberId of event.relatedMemberIds) {
      if (!ids.has(memberId)) {
        errors.push(
          `${event.id} tham chiếu thành viên không tồn tại: ${memberId}`,
        );
      }
    }
    for (const date of Object.values(event.solarDates ?? {})) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(`${date}T00:00:00`))
      ) {
        errors.push(`${event.id} có ngày dương không hợp lệ: ${date}`);
      }
    }
  }

  return errors;
}
