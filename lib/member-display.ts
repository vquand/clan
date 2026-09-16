import {
  MEMBER_AVATAR_STYLES,
  type Member,
  type MemberAvatarStyle,
} from '../data/types.ts';
import { type Locale, translate } from './i18n.ts';

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseDate(value: string | undefined): DateParts | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getLocalDateParts(date: Date): DateParts | undefined {
  if (Number.isNaN(date.getTime())) return undefined;
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function completedYears(start: DateParts, end: DateParts) {
  let years = end.year - start.year;
  const beforeAnniversary =
    end.month < start.month ||
    (end.month === start.month && end.day < start.day);
  if (beforeAnniversary) years -= 1;
  return years >= 0 ? years : undefined;
}

function calculateAgeAtDeath(member: Member) {
  if (member.ageAtDeath !== undefined) return member.ageAtDeath;

  const birthDate = parseDate(member.birthDate);
  const deathDate = parseDate(member.deathDate);
  if (deathDate) {
    if (birthDate) return completedYears(birthDate, deathDate);
    if (member.birthYear !== undefined) {
      const years = deathDate.year - member.birthYear;
      return years >= 0 ? years : undefined;
    }
  }

  if (member.birthYear !== undefined && member.deathYear !== undefined) {
    const years = member.deathYear - member.birthYear;
    return years >= 0 ? years : undefined;
  }
  return undefined;
}

function calculateMemberAge(member: Member, referenceDate: Date) {
  const birthDate = parseDate(member.birthDate);
  if (member.status === 'deceased') return calculateAgeAtDeath(member);

  const currentDate = getLocalDateParts(referenceDate);
  if (!currentDate) return undefined;
  if (birthDate) return completedYears(birthDate, currentDate);
  if (member.birthYear === undefined) return undefined;

  const years = currentDate.year - member.birthYear;
  return years >= 0 ? years : undefined;
}

export function getMemberAgeAtDeath(member: Member) {
  return member.status === 'deceased'
    ? calculateAgeAtDeath(member)
    : undefined;
}

export function formatMemberStatus(member: Member, locale: Locale = 'vi') {
  if (member.status === 'unknown') {
    return translate(locale, 'unknownStatus');
  }
  if (member.status !== 'deceased') return undefined;

  const age = getMemberAgeAtDeath(member);
  return age === undefined
    ? translate(locale, 'deceased')
    : translate(locale, 'deceasedAtAge', { age });
}

function formatRecordedDeathAge(member: Member) {
  if (member.ageAtDeath === undefined) return undefined;
  if (member.ageAtDeathQualifier === 'under') return `[<${member.ageAtDeath}]`;
  if (member.ageAtDeathQualifier === 'approximately')
    return `[~${member.ageAtDeath}]`;
  return `[${member.ageAtDeath}]`;
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
    const recordedAge = formatRecordedDeathAge(member);
    if (!member.deathDate && recordedAge) return recordedAge;
    if (age !== undefined) return `[${age}]`;
    if (recordedAge) return recordedAge;
    return member.ageGroup === 'senior' ? '[60+]' : '[ -- ]';
  }
  if (age !== undefined) return String(age);
  return member.ageGroup === 'senior' ? '60+' : '--';
}
