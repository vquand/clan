import type { ClanEvent, Member } from '../data/types';

export function getMember(id: string, allMembers: Member[]) {
  return allMembers.find((member) => member.id === id);
}

export function getChildren(id: string, allMembers: Member[]) {
  return allMembers
    .filter((member) => member.parentIds.includes(id))
    .sort((a, b) => a.birthYear - b.birthYear);
}

export function getRelatives(member: Member, allMembers: Member[]) {
  return allMembers.filter(
    (candidate) =>
      candidate.id !== member.id &&
      (member.parentIds.includes(candidate.id) ||
        member.spouseIds.includes(candidate.id) ||
        candidate.parentIds.includes(member.id) ||
        (member.parentIds.length > 0 &&
          member.parentIds.some((id) => candidate.parentIds.includes(id)))),
  );
}

export function describeRelationship(
  selected: Member,
  related: Member,
  allMembers: Member[],
) {
  if (selected.spouseIds.includes(related.id)) {
    return related.gender === 'female' ? 'Vợ' : 'Chồng';
  }
  if (selected.parentIds.includes(related.id)) {
    return related.gender === 'female' ? 'Mẹ' : 'Cha';
  }
  if (related.parentIds.includes(selected.id)) {
    return related.gender === 'female' ? 'Con gái' : 'Con trai';
  }
  const sharedParent = selected.parentIds.some((id) =>
    related.parentIds.includes(id),
  );
  if (sharedParent) {
    return related.gender === 'female' ? 'Chị/em gái' : 'Anh/em trai';
  }
  return allMembers.some(
    (member) =>
      member.parentIds.includes(selected.id) &&
      member.spouseIds.includes(related.id),
  )
    ? 'Con dâu/rể'
    : 'Họ hàng';
}

export function getEventDate(event: ClanEvent, year: number) {
  if (event.calendar === 'lunar') return event.solarDates?.[year] ?? null;
  if (event.recurrence === 'once' && event.year !== year) return null;
  const month = String(event.month).padStart(2, '0');
  const day = String(event.day).padStart(2, '0');
  return `${event.year ?? year}-${month}-${day}`;
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
