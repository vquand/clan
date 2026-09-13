import type { ClanData } from './clan-contract';

export interface AdminMemberInput {
  fullName: string;
  familiarName?: string;
  gender: 'male' | 'female' | 'other';
  clanRelation: 'lineage' | 'marriage';
  birthYear?: number | string;
  birthDate?: string;
  status?: 'living' | 'deceased';
  deathYear?: number | string;
  deathDate?: string;
  ageAtDeath?: number | string;
  ageAtDeathQualifier?: 'exact' | 'approximately' | 'under';
  ageGroup?: 'senior';
  avatarStyle?: 'default' | 'style-1' | 'style-2' | 'style-3';
  avatarImageUrl?: string;
  deathAnniversaryLunarDay?: number | string;
  deathAnniversaryLunarMonth?: number | string;
  hometown?: string;
  residence?: string;
  biography?: string;
  parentIds: string[];
  spouseIds: string[];
}

export interface AdminEventInput {
  title: string;
  type: 'death-anniversary' | 'clan-ceremony' | 'gathering';
  calendar: 'solar' | 'lunar';
  day: number | string;
  month: number | string;
  recurrence: 'annual' | 'once';
  year?: number | string;
  relatedMemberIds: string[];
  location: string;
  description?: string;
  solarDates?: Record<number, string>;
}

export type AdminData = ClanData;
