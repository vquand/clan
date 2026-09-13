import type { Member } from '../data/types';

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function completedYears(start: Date, end: Date) {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  const beforeAnniversary =
    end.getUTCMonth() < start.getUTCMonth() ||
    (end.getUTCMonth() === start.getUTCMonth() &&
      end.getUTCDate() < start.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return years >= 0 ? years : undefined;
}

function calculateMemberAge(member: Member, referenceDate: Date) {
  if (member.status !== 'living' && member.status !== 'deceased') {
    return undefined;
  }

  const endDate =
    member.status === 'deceased' ? parseDate(member.deathDate) : referenceDate;
  if (!endDate) return undefined;

  const birthDate = parseDate(member.birthDate);
  if (birthDate) return completedYears(birthDate, endDate);
  if (member.birthYear === undefined) return undefined;

  const years = endDate.getUTCFullYear() - member.birthYear;
  return years >= 0 ? years : undefined;
}

export function formatMemberAge(member: Member, referenceDate = new Date()) {
  const age = calculateMemberAge(member, referenceDate);
  if (member.status === 'deceased') {
    return age === undefined ? '[ -- ]' : `[${age}]`;
  }
  return age === undefined ? '--' : String(age);
}
