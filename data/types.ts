export type LifeStatus = 'living' | 'deceased';
export type ClanRelation = 'lineage' | 'marriage';
export const MEMBER_AGE_GROUPS = ['senior'] as const;
export type MemberAgeGroup = (typeof MEMBER_AGE_GROUPS)[number];
export const MEMBER_AVATAR_STYLES = [
  'default',
  'style-1',
  'style-2',
  'style-3',
] as const;
export type MemberAvatarStyle = (typeof MEMBER_AVATAR_STYLES)[number];

export interface Member {
  id: string;
  fullName: string;
  familiarName?: string;
  gender: 'male' | 'female' | 'other';
  clanRelation: ClanRelation;
  generation: number;
  branch?: string;
  birthYear?: number;
  birthDate?: string;
  status?: LifeStatus;
  deathDate?: string;
  ageGroup?: MemberAgeGroup;
  avatarStyle?: MemberAvatarStyle;
  avatarImageUrl?: string;
  deathAnniversaryLunar?: { day: number; month: number };
  parentIds: string[];
  spouseIds: string[];
  hometown?: string;
  residence?: string;
  biography?: string;
}

export interface ClanEvent {
  id: string;
  title: string;
  type: 'death-anniversary' | 'clan-ceremony' | 'gathering';
  calendar: 'solar' | 'lunar';
  day: number;
  month: number;
  recurrence: 'annual' | 'once';
  year?: number;
  relatedMemberIds: string[];
  location: string;
  description?: string;
  solarDates?: Record<number, string>;
}
