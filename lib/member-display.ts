import {
  MEMBER_AVATAR_STYLES,
  type Member,
  type MemberAvatarStyle,
} from '../data/types.ts';

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

export type MemberAvatarVariant =
  | 'male'
  | 'female'
  | 'senior-man'
  | 'senior-woman'
  | 'young-man'
  | 'young-woman'
  | 'toddler-boy'
  | 'toddler-girl'
  | 'baby'
  | 'unknown';

export function getMemberAvatarVariant(
  member: Member,
  referenceDate = new Date(),
): MemberAvatarVariant {
  if (member.gender === 'other') return 'unknown';

  const age = calculateMemberAge(member, referenceDate);
  if (age !== undefined) {
    if (age < 3) return 'baby';
    if (age < 12)
      return member.gender === 'male' ? 'toddler-boy' : 'toddler-girl';
    if (age < 25) return member.gender === 'male' ? 'young-man' : 'young-woman';
    if (age >= 60)
      return member.gender === 'male' ? 'senior-man' : 'senior-woman';
  }

  if (member.ageGroup === 'senior') {
    return member.gender === 'male' ? 'senior-man' : 'senior-woman';
  }

  return member.gender;
}

export function getMemberAvatarSource(
  member: Member,
  referenceDate = new Date(),
) {
  const customImage = member.avatarImageUrl?.trim();
  if (customImage) return customImage;

  const variant = getMemberAvatarVariant(member, referenceDate);
  const style: MemberAvatarStyle = MEMBER_AVATAR_STYLES.includes(
    member.avatarStyle ?? 'default',
  )
    ? (member.avatarStyle ?? 'default')
    : 'default';
  const styleSuffix = style === 'default' ? '' : `-${style}`;
  return `/people-icons/${variant}${styleSuffix}.png`;
}

export function formatMemberAge(member: Member, referenceDate = new Date()) {
  const age = calculateMemberAge(member, referenceDate);
  if (member.status === 'deceased') {
    if (age !== undefined) return `[${age}]`;
    return member.ageGroup === 'senior' ? '[60+]' : '[ -- ]';
  }
  if (age !== undefined) return String(age);
  return member.ageGroup === 'senior' ? '60+' : '--';
}
