'use client';

import type { SubmitEvent } from 'react';
import { useMemo, useState } from 'react';

import { AdminSiblingOrder } from '@/components/admin/admin-sibling-order';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { AdminMemberInput } from '@/lib/admin-contract';
import { getSiblings } from '@/lib/clan';
import type { Member } from '@/data/types';

interface MemberFormProps {
  member: Member | null;
  members: Member[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (
    input: AdminMemberInput,
    siblingOrderIds?: string[],
  ) => Promise<void>;
}

interface MemberFormState {
  fullName: string;
  familiarName: string;
  gender: AdminMemberInput['gender'];
  clanRelation: AdminMemberInput['clanRelation'];
  birthYear: string;
  birthDate: string;
  siblingOrder: string;
  status: '' | 'living' | 'deceased';
  deathYear: string;
  deathDate: string;
  ageAtDeath: string;
  ageAtDeathQualifier: '' | NonNullable<AdminMemberInput['ageAtDeathQualifier']>;
  ageGroup: '' | 'senior';
  headStatus: '' | 'current' | 'previous';
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
  siblingOrder: '',
  status: 'living',
  deathYear: '',
  deathDate: '',
  ageAtDeath: '',
  ageAtDeathQualifier: '',
  ageGroup: '',
  headStatus: '',
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
    siblingOrder: member.siblingOrder?.toString() ?? '',
    status: member.status ?? '',
    deathYear: member.deathYear?.toString() ?? '',
    deathDate: member.deathDate ?? '',
    ageAtDeath: member.ageAtDeath?.toString() ?? '',
    ageAtDeathQualifier: member.ageAtDeathQualifier ?? '',
    ageGroup: member.ageGroup ?? '',
    headStatus: member.isClanHead
      ? 'current'
      : member.isPreviousClanHead
        ? 'previous'
        : '',
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
    siblingOrder: optionalValue(form.siblingOrder),
    status: form.status || undefined,
    deathYear: optionalValue(form.deathYear),
    deathDate: optionalValue(form.deathDate),
    ageAtDeath: optionalValue(form.ageAtDeath),
    ageAtDeathQualifier: form.ageAtDeathQualifier || undefined,
    ageGroup: form.ageGroup || undefined,
    isClanHead: form.headStatus === 'current',
    isPreviousClanHead: form.headStatus === 'previous',
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
  const anchor = useComboboxAnchor();
  const options = members
    .filter((candidate) => candidate.id !== currentMemberId)
    .map((candidate) => ({ id: candidate.id, name: candidate.fullName }));
  const optionById = new Map(options.map((option) => [option.id, option]));
  const selectedOptions = value
    .map((id) => optionById.get(id))
    .filter((option): option is (typeof options)[number] => Boolean(option));

  return (
    <div className="admin-field admin-field--wide">
      <label htmlFor={id}>{label}</label>
      <Combobox
        items={options}
        multiple
        value={selectedOptions}
        itemToStringLabel={(option) => option.name}
        onValueChange={(nextValue) => onChange(nextValue.map((option) => option.id))}
      >
        <ComboboxChips ref={anchor} className="admin-relation-picker">
          <ComboboxValue>
            {(selected: typeof options) => (
              <>
                {selected.map((option) => (
                  <ComboboxChip
                    key={option.id}
                    removeLabel={`Remove ${option.name}`}
                  >
                    {option.name}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  id={id}
                  placeholder="Search by name"
                  aria-label={label}
                />
                <ComboboxTrigger aria-label={`Open ${label} list`} />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor} className="admin-relation-picker-content">
          <ComboboxEmpty>No matching member found.</ComboboxEmpty>
          <ComboboxList>
            {(option: (typeof options)[number], index) => (
              <ComboboxItem key={option.id} value={option} index={index}>
                {option.name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
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
  const siblingCandidates = useMemo(() => {
    if (!member || form.parentIds.length === 0) return [];
    const parentIds = new Set(form.parentIds);
    return getSiblings(member.id, [
      ...members.filter((candidate) => candidate.id !== member.id),
      { ...member, parentIds: form.parentIds },
    ]).filter(
      (candidate) =>
        candidate.id === member.id ||
        candidate.parentIds.some((parentId) => parentIds.has(parentId)),
    );
  }, [form.parentIds, member, members]);
  const [siblingOrderOverride, setSiblingOrderOverride] = useState<
    string[] | null
  >(null);
  const [siblingOrderDirty, setSiblingOrderDirty] = useState(false);

  const siblingOrder =
    siblingOrderOverride ?? siblingCandidates.map((candidate) => candidate.id);
  function setField<Key extends keyof MemberFormState>(
    key: Key,
    value: MemberFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = toPayload(form);
    const currentHead = members.find(
      (candidate) =>
        candidate.isClanHead && candidate.id !== (member?.id ?? null),
    );
    if (
      payload.isClanHead &&
      currentHead &&
      !window.confirm(
        `${currentHead.fullName} is currently the clan head. Make ${form.fullName || 'this member'} the new clan head? ${currentHead.fullName} will be marked as a previous head.`,
      )
    ) {
      return;
    }
    await onSubmit(
      {
        ...payload,
        ...(payload.isClanHead && currentHead
          ? { confirmClanHeadChange: true }
          : {}),
      },
      siblingOrderDirty && siblingOrder.length > 1 ? siblingOrder : undefined,
    );
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
          <label htmlFor="member-head-status">Clan head status</label>
          <select
            id="member-head-status"
            className="admin-select"
            value={form.headStatus}
            onChange={(event) =>
              setField(
                'headStatus',
                event.target.value as MemberFormState['headStatus'],
              )
            }
          >
            <option value="">None</option>
            <option
              value="current"
              disabled={form.status === 'deceased' && !member?.isClanHead}
            >
              Current clan head
            </option>
            <option value="previous">Previous clan head</option>
          </select>
          {form.status === 'deceased' && member?.isClanHead && (
            <small>Saving marks this current head as a previous head.</small>
          )}
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
        {siblingCandidates.length > 1 && (
          <div className="admin-field">
            <label htmlFor="member-sibling-rank">Sibling order</label>
            <Input
              id="member-sibling-rank"
              type="number"
              min="1"
              max={siblingCandidates.length}
              value={form.siblingOrder}
              onChange={(event) => setField('siblingOrder', event.target.value)}
              aria-describedby="member-sibling-order-help"
            />
            <small id="member-sibling-order-help">
              Optional manual rank, oldest to youngest. Saving shifts the other
              siblings to keep ranks consecutive.
            </small>
          </div>
        )}
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
          onChange={(value) => {
            setField('parentIds', value);
            setField('siblingOrder', '');
            setSiblingOrderOverride(null);
            setSiblingOrderDirty(false);
          }}
        />
        <RelationPicker
          id="member-spouses"
          label="Spouse(s)"
          value={form.spouseIds}
          members={members}
          currentMemberId={member?.id}
          onChange={(value) => setField('spouseIds', value)}
        />
        {siblingOrder.length > 1 && (
          <AdminSiblingOrder
            members={siblingCandidates}
            memberIds={siblingOrder}
            onChange={(value) => {
              setSiblingOrderOverride(value);
              setSiblingOrderDirty(true);
              if (member) {
                const nextRank = value.indexOf(member.id);
                if (nextRank >= 0) {
                  setField('siblingOrder', String(nextRank + 1));
                }
              }
            }}
          />
        )}
      </div>
      <div className="admin-form-actions">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : member ? 'Save member' : 'Add member'}
        </Button>
      </div>
    </form>
  );
}
