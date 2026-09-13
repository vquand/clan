'use client';

import type { SubmitEvent } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { AdminMemberInput } from '@/lib/admin-contract';
import type { Member } from '@/data/types';

interface MemberFormProps {
  member: Member | null;
  members: Member[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: AdminMemberInput) => Promise<void>;
}

interface MemberFormState {
  fullName: string;
  familiarName: string;
  gender: AdminMemberInput['gender'];
  clanRelation: AdminMemberInput['clanRelation'];
  birthYear: string;
  birthDate: string;
  status: '' | 'living' | 'deceased';
  deathYear: string;
  deathDate: string;
  ageAtDeath: string;
  ageAtDeathQualifier: '' | NonNullable<AdminMemberInput['ageAtDeathQualifier']>;
  ageGroup: '' | 'senior';
  avatarStyle: NonNullable<AdminMemberInput['avatarStyle']>;
  avatarImageUrl: string;
  deathAnniversaryLunarDay: string;
  deathAnniversaryLunarMonth: string;
  hometown: string;
  residence: string;
  biography: string;
  parentIds: string[];
  spouseIds: string[];
}

const blankForm: MemberFormState = {
  fullName: '',
  familiarName: '',
  gender: 'other',
  clanRelation: 'lineage',
  birthYear: '',
  birthDate: '',
  status: 'living',
  deathYear: '',
  deathDate: '',
  ageAtDeath: '',
  ageAtDeathQualifier: '',
  ageGroup: '',
  avatarStyle: 'default',
  avatarImageUrl: '',
  deathAnniversaryLunarDay: '',
  deathAnniversaryLunarMonth: '',
  hometown: '',
  residence: '',
  biography: '',
  parentIds: [],
  spouseIds: [],
};

function toForm(member: Member | null): MemberFormState {
  if (!member) return blankForm;
  return {
    fullName: member.fullName,
    familiarName: member.familiarName ?? '',
    gender: member.gender,
    clanRelation: member.clanRelation,
    birthYear: member.birthYear?.toString() ?? '',
    birthDate: member.birthDate ?? '',
    status: member.status ?? '',
    deathYear: member.deathYear?.toString() ?? '',
    deathDate: member.deathDate ?? '',
    ageAtDeath: member.ageAtDeath?.toString() ?? '',
    ageAtDeathQualifier: member.ageAtDeathQualifier ?? '',
    ageGroup: member.ageGroup ?? '',
    avatarStyle: member.avatarStyle ?? 'default',
    avatarImageUrl: member.avatarImageUrl ?? '',
    deathAnniversaryLunarDay: member.deathAnniversaryLunar?.day.toString() ?? '',
    deathAnniversaryLunarMonth: member.deathAnniversaryLunar?.month.toString() ?? '',
    hometown: member.hometown ?? '',
    residence: member.residence ?? '',
    biography: member.biography ?? '',
    parentIds: member.parentIds,
    spouseIds: member.spouseIds,
  };
}

function optionalValue(value: string) {
  return value.trim() || undefined;
}

function toPayload(form: MemberFormState): AdminMemberInput {
  return {
    fullName: form.fullName,
    familiarName: optionalValue(form.familiarName),
    gender: form.gender,
    clanRelation: form.clanRelation,
    birthYear: optionalValue(form.birthYear),
    birthDate: optionalValue(form.birthDate),
    status: form.status || undefined,
    deathYear: optionalValue(form.deathYear),
    deathDate: optionalValue(form.deathDate),
    ageAtDeath: optionalValue(form.ageAtDeath),
    ageAtDeathQualifier: form.ageAtDeathQualifier || undefined,
    ageGroup: form.ageGroup || undefined,
    avatarStyle: form.avatarStyle,
    avatarImageUrl: optionalValue(form.avatarImageUrl),
    deathAnniversaryLunarDay: optionalValue(form.deathAnniversaryLunarDay),
    deathAnniversaryLunarMonth: optionalValue(form.deathAnniversaryLunarMonth),
    hometown: optionalValue(form.hometown),
    residence: optionalValue(form.residence),
    biography: optionalValue(form.biography),
    parentIds: form.parentIds,
    spouseIds: form.spouseIds,
  };
}

function RelationPicker({
  id,
  label,
  value,
  members,
  currentMemberId,
  onChange,
}: {
  id: string;
  label: string;
  value: string[];
  members: Member[];
  currentMemberId?: string;
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="admin-field admin-field--wide">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="admin-multi-select"
        multiple
        size={Math.min(5, Math.max(3, members.length))}
        value={value}
        onChange={(event) =>
          onChange(
            Array.from(event.currentTarget.selectedOptions, (option) => option.value),
          )
        }
      >
        {members
          .filter((candidate) => candidate.id !== currentMemberId)
          .map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.fullName}
            </option>
          ))}
      </select>
      <small>Select zero or more. Hold Ctrl/Cmd to choose multiple.</small>
    </div>
  );
}

export function AdminMemberForm({
  member,
  members,
  pending,
  onCancel,
  onSubmit,
}: MemberFormProps) {
  const [form, setForm] = useState<MemberFormState>(() => toForm(member));
  function setField<Key extends keyof MemberFormState>(
    key: Key,
    value: MemberFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(toPayload(form));
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid">
        <div className="admin-field admin-field--wide">
          <label htmlFor="member-full-name">Full name *</label>
          <Input
            id="member-full-name"
            required
            value={form.fullName}
            onChange={(event) => setField('fullName', event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="member-familiar-name">Familiar name</label>
          <Input
            id="member-familiar-name"
            value={form.familiarName}
            onChange={(event) => setField('familiarName', event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="member-gender">Gender *</label>
          <select
            id="member-gender"
            className="admin-select"
            value={form.gender}
            onChange={(event) =>
              setField('gender', event.target.value as MemberFormState['gender'])
            }
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other / unknown</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="member-clan-relation">Clan relation *</label>
          <select
            id="member-clan-relation"
            className="admin-select"
            value={form.clanRelation}
            onChange={(event) =>
              setField(
                'clanRelation',
                event.target.value as MemberFormState['clanRelation'],
              )
            }
          >
            <option value="lineage">Lineage</option>
            <option value="marriage">Joined by marriage</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="member-status">Life status</label>
          <select
            id="member-status"
            className="admin-select"
            value={form.status}
            onChange={(event) =>
              setField('status', event.target.value as MemberFormState['status'])
            }
          >
            <option value="">Unknown</option>
            <option value="living">Living</option>
            <option value="deceased">Deceased</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="member-birth-year">Birth year</label>
          <Input
            id="member-birth-year"
            type="number"
            min="1"
            max="9999"
            value={form.birthYear}
            onChange={(event) => setField('birthYear', event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="member-birth-date">Birth date</label>
          <Input
            id="member-birth-date"
            type="date"
            value={form.birthDate}
            onChange={(event) => setField('birthDate', event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="member-death-year">Death year</label>
          <Input
            id="member-death-year"
            type="number"
            min="1"
            max="9999"
            value={form.deathYear}
            onChange={(event) => setField('deathYear', event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="member-death-date">Death date</label>
          <Input
            id="member-death-date"
            type="date"
            value={form.deathDate}
            onChange={(event) => setField('deathDate', event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="member-age-at-death">Recorded age at death</label>
          <Input
            id="member-age-at-death"
            type="number"
            min="0"
            max="150"
            value={form.ageAtDeath}
            onChange={(event) => setField('ageAtDeath', event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="member-age-qualifier">Age qualifier</label>
          <select
            id="member-age-qualifier"
            className="admin-select"
            value={form.ageAtDeathQualifier}
            onChange={(event) =>
              setField(
                'ageAtDeathQualifier',
                event.target.value as MemberFormState['ageAtDeathQualifier'],
              )
            }
          >
            <option value="">None</option>
            <option value="exact">Exact</option>
            <option value="approximately">Approximately</option>
            <option value="under">Under</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="member-age-group">Approximate age group</label>
          <select
            id="member-age-group"
            className="admin-select"
            value={form.ageGroup}
            onChange={(event) =>
              setField('ageGroup', event.target.value as MemberFormState['ageGroup'])
            }
          >
            <option value="">None</option>
            <option value="senior">Senior (60+)</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="member-lunar-day">Lunar anniversary day</label>
          <Input
            id="member-lunar-day"
            type="number"
            min="1"
            max="30"
            value={form.deathAnniversaryLunarDay}
            onChange={(event) =>
              setField('deathAnniversaryLunarDay', event.target.value)
            }
          />
        </div>
        <div className="admin-field">
          <label htmlFor="member-lunar-month">Lunar anniversary month</label>
          <Input
            id="member-lunar-month"
            type="number"
            min="1"
            max="12"
            value={form.deathAnniversaryLunarMonth}
            onChange={(event) =>
              setField('deathAnniversaryLunarMonth', event.target.value)
            }
          />
        </div>
        <div className="admin-field">
          <label htmlFor="member-hometown">Hometown</label>
          <Input
            id="member-hometown"
            value={form.hometown}
            onChange={(event) => setField('hometown', event.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="member-residence">Residence</label>
          <Input
            id="member-residence"
            value={form.residence}
            onChange={(event) => setField('residence', event.target.value)}
          />
        </div>
        <div className="admin-field admin-field--wide">
          <label htmlFor="member-biography">Notes</label>
          <Textarea
            id="member-biography"
            rows={4}
            value={form.biography}
            onChange={(event) => setField('biography', event.target.value)}
          />
        </div>
        <RelationPicker
          id="member-parents"
          label="Parents"
          value={form.parentIds}
          members={members}
          currentMemberId={member?.id}
          onChange={(value) => setField('parentIds', value)}
        />
        <RelationPicker
          id="member-spouses"
          label="Spouse(s)"
          value={form.spouseIds}
          members={members}
          currentMemberId={member?.id}
          onChange={(value) => setField('spouseIds', value)}
        />
      </div>
      <div className="admin-form-actions">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : member ? 'Save member' : 'Add member'}
        </Button>
      </div>
    </form>
  );
}
