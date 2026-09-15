'use client';

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Flower2,
  LogOut,
  KeyRound,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sprout,
  TreePine,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  SubmitEvent,
} from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CalendarTypeIcon } from '@/components/calendar-type-icon';
import { ClanEventIcon } from '@/components/clan-event-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminAvatarPicker } from '@/components/admin/admin-avatar-picker';
import { AdminEventForm } from '@/components/admin/admin-event-form';
import { AdminLocationForm } from '@/components/admin/admin-location-form';
import { AdminMemberForm } from '@/components/admin/admin-member-form';
import { AdminSiblingOrder } from '@/components/admin/admin-sibling-order';
import { ThemeToggle } from '@/components/theme-toggle';
import type { ClanEvent, ClanLocation, Member } from '@/data/types';
import {
  buildCalendarDays,
  describeRelationship,
  getChildren,
  getEventDate,
  getMember,
  getLunarDate,
  getMoonPhase,
  getRelatives,
  getSiblings,
  orderCoupleMembers,
} from '@/lib/clan';
import {
  DEFAULT_LOCALE,
  getIntlLocale,
  type Locale,
  LOCALES,
  translate,
  weekdayLabels,
} from '@/lib/i18n';
import {
  formatMemberAge,
  getMemberAvatarSource,
  getMemberAvatarVariant,
} from '@/lib/member-display';
import {
  normalizeReadingSize,
  READING_SIZE_STORAGE_KEY,
  type ReadingSize,
} from '@/lib/preferences';
import {
  AdminApiError,
  createEvent,
  createLocation,
  createMember,
  deleteEvent,
  deleteLocation,
  deleteMember,
  fetchAdminData,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  reorderSiblings,
  updateEvent,
  updateLocation,
  updateMember,
} from '@/lib/admin-api';
import type {
  AdminData,
  AdminEventInput,
  AdminLocationInput,
  AdminMemberInput,
} from '@/lib/admin-contract';

const tabs = [
  { value: 'calendar', labelKey: 'tabCalendar', icon: CalendarDays },
  { value: 'tree', labelKey: 'tabTree', icon: TreePine },
  { value: 'members', labelKey: 'tabMembers', icon: Users },
  { value: 'locations', labelKey: 'tabLocations', icon: MapPin },
] as const;

function ArchiveAdminAccess({
  locale,
  authenticated,
  onAuthenticated,
  onLogout,
}: {
  locale: Locale;
  authenticated: boolean;
  onAuthenticated: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      await loginAdmin(username, password);
      await onAuthenticated();
      setExpanded(false);
      setUsername('');
      setPassword('');
    } catch (caughtError) {
      setError(
        caughtError instanceof AdminApiError && caughtError.status === 503
          ? translate(locale, 'adminConfigError')
          : translate(locale, 'adminLoginError'),
      );
    } finally {
      setPending(false);
    }
  }

  if (authenticated) {
    return (
      <div className="archive-admin-login archive-admin-login--authenticated">
        <span className="archive-admin-status">
          <ShieldCheck aria-hidden="true" />
          {translate(locale, 'adminMode')}
        </span>
        <Button
          className="archive-admin-trigger"
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setPending(true);
            setError('');
            void onLogout()
              .catch(() => setError(translate(locale, 'adminLoginError')))
              .finally(() => setPending(false));
          }}
        >
          <LogOut aria-hidden="true" />
          {translate(locale, 'adminSignOut')}
        </Button>
        {error && (
          <span className="archive-admin-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="archive-admin-login" data-expanded="false">
        <Button
          className="archive-admin-trigger"
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded="false"
          onClick={() => setExpanded(true)}
        >
          <ShieldCheck aria-hidden="true" />
          {translate(locale, 'adminLink')}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="archive-admin-login"
      data-expanded="true"
      aria-label={translate(locale, 'adminLink')}
      onSubmit={submit}
    >
      <Button
        className="archive-admin-trigger"
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
      >
        <ShieldCheck aria-hidden="true" />
        {pending ? '…' : translate(locale, 'adminLink')}
      </Button>
      <label className="sr-only" htmlFor="archive-admin-username">
        {translate(locale, 'adminUsername')}
      </label>
      <span className="archive-admin-input">
        <UserRound aria-hidden="true" />
        <Input
          id="archive-admin-username"
          type="text"
          autoComplete="username"
          aria-label={translate(locale, 'adminUsername')}
          placeholder=""
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </span>
      <label className="sr-only" htmlFor="archive-admin-password">
        {translate(locale, 'adminPassword')}
      </label>
      <span className="archive-admin-input">
        <KeyRound aria-hidden="true" />
        <Input
          id="archive-admin-password"
          type="password"
          autoComplete="current-password"
          aria-label={translate(locale, 'adminPassword')}
          placeholder=""
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </span>
      {error && (
        <span className="archive-admin-error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

function formatDate(date: string | undefined, locale: Locale) {
  if (!date) return translate(locale, 'unknown');
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

function toIsoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function MoonPhaseBanner({
  date,
  className = '',
}: {
  date: string;
  className?: string;
}) {
  const lunar = getLunarDate(new Date(`${date}T00:00:00`));
  const phase = getMoonPhase(lunar.day);
  return (
    <div
      className={`moon-phase-banner moon-phase-banner--${phase}${
        className ? ` ${className}` : ''
      }`}
      aria-hidden="true"
      data-moon-phase={phase}
    >
      <span className="moon-phase-banner__orb" aria-hidden="true" />
    </div>
  );
}

function MemberAvatar({
  member,
  small = false,
}: {
  member: Member;
  small?: boolean;
}) {
  const variant = getMemberAvatarVariant(member);
  const source = getMemberAvatarSource(member);
  const memorialClass =
    member.status === 'deceased' ? ' member-avatar--deceased' : '';
  return (
    <span
      className={
        small
          ? `member-avatar member-avatar--small member-avatar--${variant}${memorialClass}`
          : `member-avatar member-avatar--${variant}${memorialClass}`
      }
      aria-hidden="true"
    >
      <Image
        className="member-avatar__image"
        src={source}
        alt=""
        width={384}
        height={512}
        unoptimized
      />
      {(member.isClanHead || member.isPreviousClanHead) && (
        <span
          className={`member-avatar__head-marker ${
            member.isClanHead
              ? 'member-avatar__head-marker--current'
              : 'member-avatar__head-marker--previous'
          }`}
          aria-hidden="true"
        >
          *
        </span>
      )}
    </span>
  );
}

function memberCardClassName(baseClass: string, member: Member) {
  const memorialClass =
    member.status === 'deceased' ? ` ${baseClass}--deceased` : '';
  return `${baseClass} ${baseClass}--${member.gender}${memorialClass}`;
}

function MemberAge({ member, locale }: { member: Member; locale: Locale }) {
  const age = formatMemberAge(member);
  return (
    <span
      className={
        member.status === 'deceased'
          ? 'member-age member-age--memorial'
          : 'member-age'
      }
    >
      {translate(locale, 'age')}: {age}
    </span>
  );
}

function MemberLegend({
  locale,
  showParent = false,
}: {
  locale: Locale;
  showParent?: boolean;
}) {
  return (
    <div
      className="member-legend"
      aria-label={translate(locale, 'legendLabel')}
    >
      <span>
        <i className="legend-border legend-border--male" />
        {translate(locale, 'genderMale')}
      </span>
      <span>
        <i className="legend-border legend-border--female" />
        {translate(locale, 'genderFemale')}
      </span>
      <span>
        <i className="legend-border legend-border--memorial" />
        {translate(locale, 'legendMemorialBorder')}
      </span>
      <span>
        <code>[97]</code>
        {translate(locale, 'legendMemorialAge')}
      </span>
      {showParent && (
        <span>
          <i className="legend-line" /> {translate(locale, 'legendParent')}
        </span>
      )}
    </div>
  );
}

function MemberCard({
  member,
  locale,
  onSelect,
}: {
  member: Member;
  locale: Locale;
  onSelect: (member: Member) => void;
}) {
  return (
    <button
      className={memberCardClassName('member-card', member)}
      onClick={() => onSelect(member)}
      type="button"
    >
      <MemberAvatar member={member} />
      <span className="member-card__body">
        <span className="member-card__topline">
          <strong>{member.fullName}</strong>
          <ChevronRight aria-hidden="true" />
        </span>
        <span className="member-card__meta">
          <MemberAge member={member} locale={locale} />
          {member.branch ? ` · ${member.branch}` : ''}
        </span>
        <span className="member-card__bottom">
          <span>
            {member.residence ??
              member.hometown ??
              translate(locale, 'unknownResidence')}
          </span>
        </span>
      </span>
    </button>
  );
}

type MembersAdminControls = {
  pending: boolean;
  onAdd: () => void;
  onSiblingOrderSave: (member: Member, order: number) => Promise<boolean>;
};

function MembersView({
  members,
  locale,
  onSelect,
  admin,
}: {
  members: Member[];
  locale: Locale;
  onSelect: (member: Member) => void;
  admin?: MembersAdminControls;
}) {
  const [query, setQuery] = useState('');
  const [siblingOf, setSiblingOf] = useState('');
  const [siblingOrderDrafts, setSiblingOrderDrafts] = useState<
    Record<string, string>
  >({});
  const [siblingOrderErrors, setSiblingOrderErrors] = useState<
    Record<string, string>
  >({});
  const siblingFilterOptions = useMemo(
    () =>
      members
        .filter((member) => getSiblings(member.id, members).length > 1)
        .sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [members],
  );
  const activeSiblingFilter = siblingFilterOptions.some(
    (member) => member.id === siblingOf,
  )
    ? siblingOf
    : '';
  const orderedSiblingMembers = useMemo(
    () =>
      activeSiblingFilter ? getSiblings(activeSiblingFilter, members) : [],
    [activeSiblingFilter, members],
  );
  const siblingOrderById = new Map(
    orderedSiblingMembers.map((member, index) => [member.id, index + 1]),
  );
  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(getIntlLocale(locale));
    const sourceMembers = activeSiblingFilter ? orderedSiblingMembers : members;
    return sourceMembers.filter((member) => {
      const matchesText = [
        member.fullName,
        member.familiarName,
        member.branch,
        member.residence,
      ]
        .filter(Boolean)
        .some((value) =>
          value?.toLocaleLowerCase(getIntlLocale(locale)).includes(normalized),
        );
      return matchesText;
    });
  }, [activeSiblingFilter, locale, members, orderedSiblingMembers, query]);

  const generationCount = new Set(members.map((member) => member.generation))
    .size;

  return (
    <section className="view-panel" aria-labelledby="members-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{translate(locale, 'memberListEyebrow')}</p>
          <h2 id="members-heading">
            {translate(locale, 'memberCount', {
              count: members.length,
              generations: generationCount,
            })}
          </h2>
        </div>
        <p>{translate(locale, 'memberIntro')}</p>
      </div>
      <MemberLegend locale={locale} />
      <div className="member-toolbar">
        <div className="search-box">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="member-search">
            {translate(locale, 'searchLabel')}
          </label>
          <Input
            id="member-search"
            type="search"
            value={query}
            onValueChange={setQuery}
            onInputCapture={(event) => setQuery(event.currentTarget.value)}
            placeholder={translate(locale, 'searchPlaceholder')}
          />
        </div>
        {admin && (
          <div className="member-sibling-filter">
            <label htmlFor="member-sibling-filter">
              {translate(locale, 'adminShowSiblingsOf')}
            </label>
            <select
              id="member-sibling-filter"
              className="admin-select"
              value={activeSiblingFilter}
              onChange={(event) => {
                setSiblingOf(event.target.value);
                setQuery('');
              }}
            >
              <option value="">{translate(locale, 'adminAllMembers')}</option>
              {siblingFilterOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
        {admin && (
          <Button type="button" onClick={admin.onAdd}>
            <Plus aria-hidden="true" />
            {translate(locale, 'adminAddMember')}
          </Button>
        )}
      </div>
      {filteredMembers.length ? (
        <div className="member-grid">
          {filteredMembers.map((member) =>
            admin ? (
              <div className="member-card-admin" key={member.id}>
                {activeSiblingFilter && (
                  <div className="member-card-admin__order">
                    <label htmlFor={`member-order-${member.id}`}>
                      {translate(locale, 'adminSiblingOrder')}
                    </label>
                    <Input
                      id={`member-order-${member.id}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[1-9][0-9]*"
                      value={
                        siblingOrderDrafts[member.id] ??
                        String(siblingOrderById.get(member.id) ?? 1)
                      }
                      aria-invalid={Boolean(siblingOrderErrors[member.id])}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        if (value === '' || /^\d+$/.test(value)) {
                          setSiblingOrderDrafts((current) => ({
                            ...current,
                            [member.id]: value.replace(/^0+(?=\d)/, ''),
                          }));
                          setSiblingOrderErrors((current) => {
                            const next = { ...current };
                            delete next[member.id];
                            return next;
                          });
                        }
                      }}
                      onKeyDown={(event) => {
                        if (['e', 'E', '+', '-', '.'].includes(event.key)) {
                          event.preventDefault();
                        }
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                      onBlur={() => {
                        const value =
                          siblingOrderDrafts[member.id] ??
                          String(siblingOrderById.get(member.id) ?? 1);
                        if (!/^[1-9]\d*$/.test(value)) {
                          setSiblingOrderErrors((current) => ({
                            ...current,
                            [member.id]: translate(
                              locale,
                              'adminSiblingOrderInvalid',
                            ),
                          }));
                          return;
                        }
                        if (Number(value) > orderedSiblingMembers.length) {
                          setSiblingOrderErrors((current) => ({
                            ...current,
                            [member.id]: translate(
                              locale,
                              'adminSiblingOrderRange',
                              { count: orderedSiblingMembers.length },
                            ),
                          }));
                          return;
                        }
                        if (Number(value) !== siblingOrderById.get(member.id)) {
                          void admin
                            .onSiblingOrderSave(member, Number(value))
                            .then((saved) => {
                              if (!saved) return;
                              setSiblingOrderDrafts((current) => ({
                                ...current,
                                [member.id]: value,
                              }));
                            });
                        }
                      }}
                      aria-label={`${translate(locale, 'adminSiblingOrder')} for ${member.fullName}`}
                    />
                    {siblingOrderErrors[member.id] && (
                      <small role="alert">
                        {siblingOrderErrors[member.id]}
                      </small>
                    )}
                  </div>
                )}
                <MemberCard
                  member={member}
                  locale={locale}
                  onSelect={onSelect}
                />
              </div>
            ) : (
              <MemberCard
                key={member.id}
                member={member}
                locale={locale}
                onSelect={onSelect}
              />
            ),
          )}
        </div>
      ) : (
        <output className="empty-state">
          <Sprout aria-hidden="true" />
          <h3>{translate(locale, 'noMemberTitle')}</h3>
          <p>{translate(locale, 'noMemberBody')}</p>
        </output>
      )}
    </section>
  );
}

function PersonPill({
  member,
  locale,
  onSelect,
}: {
  member?: Member;
  locale: Locale;
  onSelect: (member: Member) => void;
}) {
  if (!member) return null;
  return (
    <button
      type="button"
      className={memberCardClassName('person-pill', member)}
      onClick={() => onSelect(member)}
    >
      <MemberAvatar member={member} small />
      <span>
        <strong>{member.fullName}</strong>
        <small>
          <MemberAge member={member} locale={locale} />
        </small>
      </span>
    </button>
  );
}

function CoupleNode({
  members,
  member,
  locale,
  onSelect,
}: {
  members: Member[];
  member: Member;
  locale: Locale;
  onSelect: (member: Member) => void;
}) {
  const spouse = getMember(member.spouseIds[0] ?? '', members);
  const [leftMember, rightMember] = orderCoupleMembers(member, spouse);
  return (
    <div className="couple-node">
      <PersonPill member={leftMember} locale={locale} onSelect={onSelect} />
      {rightMember && (
        <>
          <span
            className="union-mark"
            aria-label={translate(locale, 'spouseAria')}
          >
            &amp;
          </span>
          <PersonPill
            member={rightMember}
            locale={locale}
            onSelect={onSelect}
          />
        </>
      )}
    </div>
  );
}

function FamilyBranch({
  members,
  member,
  locale,
  onSelect,
  lineage = new Set<string>(),
}: {
  members: Member[];
  member: Member;
  locale: Locale;
  onSelect: (member: Member) => void;
  lineage?: Set<string>;
}) {
  const nextLineage = new Set(lineage).add(member.id);
  const children = getChildren(member.id, members).filter(
    (child) => !nextLineage.has(child.id),
  );

  return (
    <li>
      <CoupleNode
        members={members}
        member={member}
        locale={locale}
        onSelect={onSelect}
      />
      {children.length > 0 && (
        <ul>
          {children.map((child) => (
            <FamilyBranch
              key={child.id}
              members={members}
              member={child}
              locale={locale}
              onSelect={onSelect}
              lineage={nextLineage}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

type SiblingGroup = { parents: Member[]; children: Member[] };

function getSiblingGroups(members: Member[]): SiblingGroup[] {
  const seen = new Set<string>();
  const groups: SiblingGroup[] = [];
  for (const parent of members) {
    const children = getChildren(parent.id, members);
    if (children.length < 2) continue;
    const key = children.map((child) => child.id).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const parentIds = new Set(children.flatMap((child) => child.parentIds));
    const parents = members.filter((member) => parentIds.has(member.id));
    groups.push({
      parents:
        parents.length === 2
          ? orderCoupleMembers(parents[0], parents[1])
          : parents.length > 0
            ? parents
            : [parent],
      children,
    });
  }
  return groups;
}

function TreeSiblingOrderEditor({
  group,
  locale,
  pending,
  onSave,
}: {
  group: SiblingGroup;
  locale: Locale;
  pending: boolean;
  onSave: (memberIds: string[]) => Promise<void>;
}) {
  const sourceKey = group.children.map((child) => child.id).join('|');
  const [memberIds, setMemberIds] = useState(() => sourceKey.split('|'));

  return (
    <AdminSiblingOrder
      members={group.children}
      memberIds={memberIds}
      onChange={setMemberIds}
      onSave={() => void onSave(memberIds)}
      pending={pending}
      headingId={`tree-sibling-order-${group.children[0]?.id ?? 'group'}`}
      title={`Children of ${group.parents.map((parent) => parent.fullName).join(' and ')}`}
      description={translate(locale, 'adminTreeOrderIntro')}
    />
  );
}

type TreeAdminControls = {
  pending: boolean;
  onSave: (memberIds: string[]) => Promise<void>;
};

function TreeView({
  members,
  locale,
  onSelect,
  admin,
}: {
  members: Member[];
  locale: Locale;
  onSelect: (member: Member) => void;
  admin?: TreeAdminControls;
}) {
  const treeScrollRef = useRef<HTMLElement>(null);
  const treePointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  } | null>(null);
  const suppressTreeClickRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const roots = members.filter(
    (member) =>
      member.clanRelation === 'lineage' &&
      member.parentIds.length === 0 &&
      getChildren(member.id, members).length > 0,
  );
  const generationCount = new Set(members.map((member) => member.generation))
    .size;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = treeScrollRef.current;
      if (container)
        container.scrollLeft =
          (container.scrollWidth - container.clientWidth) / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleTreePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const container = treeScrollRef.current;
    if (!container) return;

    treePointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      moved: false,
    };
  }

  function handleTreePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const pointer = treePointerRef.current;
    const container = treeScrollRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || !container) return;

    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.moved && Math.hypot(deltaX, deltaY) < 4) return;

    pointer.moved = true;
    if (!container.hasPointerCapture(event.pointerId))
      container.setPointerCapture(event.pointerId);
    suppressTreeClickRef.current = true;
    setIsPanning(true);
    event.preventDefault();
    container.scrollLeft = pointer.scrollLeft - deltaX;
    container.scrollTop = pointer.scrollTop - deltaY;
  }

  function finishTreePointer(event: ReactPointerEvent<HTMLElement>) {
    const pointer = treePointerRef.current;
    const container = treeScrollRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (container?.hasPointerCapture(event.pointerId))
      container.releasePointerCapture(event.pointerId);
    treePointerRef.current = null;
    setIsPanning(false);
  }

  function handleTreeClickCapture(event: React.MouseEvent<HTMLElement>) {
    if (!suppressTreeClickRef.current) return;
    suppressTreeClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <section className="view-panel tree-view" aria-labelledby="tree-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{translate(locale, 'treeEyebrow')}</p>
          <h2 id="tree-heading">
            {translate(locale, 'treeCount', {
              generations: generationCount,
            })}
          </h2>
        </div>
        <p>{translate(locale, 'treeIntro')}</p>
      </div>
      {admin && (
        <section
          className="admin-tree-tools"
          aria-labelledby="admin-tree-tools-heading"
        >
          <div className="admin-tree-tools-heading">
            <div>
              <p className="eyebrow">{translate(locale, 'adminMode')}</p>
              <h3 id="admin-tree-tools-heading">Sibling order</h3>
            </div>
            <p>{translate(locale, 'adminTreeOrderIntro')}</p>
          </div>
          <div className="admin-tree-sibling-groups">
            {getSiblingGroups(members).map((group) => (
              <TreeSiblingOrderEditor
                key={group.children.map((child) => child.id).join('|')}
                group={group}
                locale={locale}
                pending={admin.pending}
                onSave={admin.onSave}
              />
            ))}
          </div>
        </section>
      )}
      <section
        className={`tree-scroll${isPanning ? ' tree-scroll--panning' : ''}`}
        aria-label={translate(locale, 'treeLabel')}
        ref={treeScrollRef}
        onPointerDown={handleTreePointerDown}
        onPointerMove={handleTreePointerMove}
        onPointerUp={finishTreePointer}
        onPointerCancel={finishTreePointer}
        onClickCapture={handleTreeClickCapture}
      >
        <div className="family-tree">
          <ul className="tree-roots">
            {roots.map((root) => (
              <FamilyBranch
                key={root.id}
                members={members}
                member={root}
                locale={locale}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      </section>
      <MemberLegend locale={locale} showParent />
    </section>
  );
}

function eventTypeLabel(event: ClanEvent, locale: Locale) {
  if (event.type === 'death-anniversary')
    return translate(locale, 'deathAnniversary');
  if (event.type === 'clan-ceremony') return translate(locale, 'clanCeremony');
  return translate(locale, 'gathering');
}

function formatLunarDate(date: string, locale: Locale) {
  const lunar = getLunarDate(new Date(`${date}T00:00:00`));
  return translate(locale, 'lunarDateWithLeap', {
    day: lunar.day,
    month: lunar.month,
    leap: lunar.isLeapMonth ? ` · ${translate(locale, 'lunarLeap')}` : '',
  });
}

function EventDetail({
  event,
  date,
  locale,
  onOpenChange,
}: {
  event: ClanEvent | null;
  date: string | null;
  locale: Locale;
  onOpenChange: (open: boolean) => void;
}) {
  if (!event || !date) return null;
  return (
    <Dialog open={Boolean(event)} onOpenChange={onOpenChange}>
      <DialogContent className="event-dialog">
        <DialogHeader>
          <div className="event-detail__eyebrow">
            <Badge variant="outline">{eventTypeLabel(event, locale)}</Badge>
            <ClanEventIcon event={event} aria-hidden="true" />
          </div>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            {event.description || translate(locale, 'eventDetailsIntro')}
          </DialogDescription>
        </DialogHeader>
        <div className="event-detail">
          <div className="event-detail__dates">
            <div>
              <span className="eyebrow">{translate(locale, 'solarDate')}</span>
              <strong>{formatDate(date, locale)}</strong>
            </div>
            <div>
              <span className="eyebrow">
                {translate(locale, 'lunarDateLabel')}
              </span>
              <strong>{formatLunarDate(date, locale)}</strong>
            </div>
          </div>
          <div className="event-detail__location">
            <span className="event-detail__location-icon">
              <MapPin aria-hidden="true" />
            </span>
            <div>
              <span className="eyebrow">
                {translate(locale, 'eventLocation')}
              </span>
              <strong>
                {event.location || translate(locale, 'noLocation')}
              </strong>
              {event.locationAddress && <p>{event.locationAddress}</p>}
            </div>
          </div>
          {event.locationGoogleMapUrl && (
            <a
              className="event-map-card"
              href={event.locationGoogleMapUrl}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin aria-hidden="true" />
              <span>
                <strong>{translate(locale, 'eventMap')}</strong>
                <small>{translate(locale, 'openMap')}</small>
              </span>
              <ExternalLink aria-hidden="true" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CalendarView({
  events,
  locale,
  admin,
}: {
  events: ClanEvent[];
  locale: Locale;
  admin?: {
    pending: boolean;
    onAdd: () => void;
    onEdit: (event: ClanEvent) => void;
    onDelete: (event: ClanEvent) => void;
  };
}) {
  const [visible, setVisible] = useState({ year: 2026, month: 8 });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<{
    event: ClanEvent;
    date: string;
  } | null>(null);
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const now = new Date();
      setVisible({ year: now.getFullYear(), month: now.getMonth() });
      setSelectedDate(toIsoDate(now));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const calendarGrid = calendarGridRef.current;
    if (!calendarGrid || typeof ResizeObserver === 'undefined') return;

    const updateCalendarHeight = () => {
      const nextHeight = Math.ceil(calendarGrid.getBoundingClientRect().height);
      setCalendarHeight((current) =>
        current === nextHeight ? current : nextHeight,
      );
    };

    updateCalendarHeight();
    const observer = new ResizeObserver(updateCalendarHeight);
    observer.observe(calendarGrid);
    return () => observer.disconnect();
  }, [visible.year, visible.month]);
  const days = buildCalendarDays(visible.year, visible.month);
  const datedEvents = events
    .map((event) => ({ event, date: getEventDate(event, visible.year) }))
    .filter((item): item is { event: ClanEvent; date: string } =>
      Boolean(item.date),
    );
  const displayedEvents = selectedDate
    ? datedEvents.filter((item) => item.date === selectedDate)
    : datedEvents;
  function moveMonth(offset: number) {
    setSelectedDate(null);
    setVisible((current) => {
      const date = new Date(current.year, current.month + offset, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }
  function selectToday() {
    const now = new Date();
    setVisible({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(toIsoDate(now));
  }
  const todayIso = toIsoDate(new Date());
  const monthTitle = new Intl.DateTimeFormat(getIntlLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(visible.year, visible.month, 1));
  return (
    <section className="view-panel" aria-labelledby="calendar-heading">
      <div className="section-heading calendar-heading">
        <div>
          <p className="eyebrow">{translate(locale, 'familyDays')}</p>
          <h2 id="calendar-heading">{monthTitle}</h2>
        </div>
        <div className="calendar-actions">
          <Button
            variant="outline"
            size="icon"
            onClick={() => moveMonth(-1)}
            aria-label={translate(locale, 'previousMonth')}
          >
            <ArrowLeft />
          </Button>
          <Button variant="outline" onClick={selectToday}>
            {translate(locale, 'today')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => moveMonth(1)}
            aria-label={translate(locale, 'nextMonth')}
          >
            <ArrowRight />
          </Button>
          {admin && (
            <Button type="button" onClick={admin.onAdd}>
              <Plus aria-hidden="true" />
              {translate(locale, 'adminAddEvent')}
            </Button>
          )}
        </div>
      </div>
      <div
        className="calendar-legend"
        aria-label={translate(locale, 'calendarLegend')}
      >
        <span>
          <CalendarTypeIcon calendar="solar" aria-hidden="true" />
          <strong>{translate(locale, 'solarDate')}</strong>
        </span>
        <span>
          <CalendarTypeIcon calendar="lunar" aria-hidden="true" />
          <strong className="lunar-chip">
            {translate(locale, 'lunarDateLabel')}
          </strong>
        </span>
      </div>
      <div className="calendar-layout">
        <div
          ref={calendarGridRef}
          className="calendar-grid"
          aria-label={monthTitle}
        >
          {weekdayLabels[locale].map((day) => (
            <div className="weekday" key={day}>
              {day}
            </div>
          ))}
          {days.map(({ date, inMonth }) => {
            const iso = [
              date.getFullYear(),
              String(date.getMonth() + 1).padStart(2, '0'),
              String(date.getDate()).padStart(2, '0'),
            ].join('-');
            const isToday = iso === todayIso;
            const dayEvents = datedEvents.filter((item) => item.date === iso);
            const selectDate = () =>
              setSelectedDate((current) => (current === iso ? null : iso));
            return (
              <div
                className={`${inMonth ? 'calendar-day' : 'calendar-day calendar-day--muted'}${
                  isToday ? ' calendar-day--today' : ''
                }${selectedDate === iso ? ' calendar-day--selected' : ''}`}
                key={iso}
              >
                <MoonPhaseBanner date={iso} />
                <button
                  type="button"
                  className="calendar-day__select"
                  aria-label={`${formatDate(iso, locale)} · ${formatLunarDate(iso, locale)}`}
                  aria-pressed={selectedDate === iso}
                  onClick={selectDate}
                >
                  <time dateTime={iso}>{date.getDate()}</time>
                  <span
                    className="lunar-chip"
                    aria-label={formatLunarDate(iso, locale)}
                  >
                    {(() => {
                      const lunar = getLunarDate(date);
                      return `${lunar.day}/${lunar.month}${lunar.isLeapMonth ? '*' : ''}`;
                    })()}
                  </span>
                </button>
                {dayEvents.map(({ event }) => (
                  <button
                    type="button"
                    className={`day-event day-event--${event.type}`}
                    key={event.id}
                    title={event.title}
                    onClick={(eventToClick) => {
                      eventToClick.stopPropagation();
                      setSelectedEvent({ event, date: iso });
                    }}
                  >
                    <span aria-hidden="true">
                      <ClanEventIcon event={event} />
                    </span>
                    <span className="day-event__title">{event.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <aside
          className="event-list"
          aria-label={translate(locale, 'importantDatesLabel')}
          style={
            calendarHeight === null
              ? undefined
              : ({
                  '--calendar-height': `${calendarHeight}px`,
                } as CSSProperties)
          }
        >
          <div className="event-list__heading">
            <div className="event-list__heading-copy">
              <p className="eyebrow">
                {selectedDate
                  ? translate(locale, 'selectedDay')
                  : translate(locale, 'yearEyebrow', { year: visible.year })}
              </p>
              <h3>
                {selectedDate
                  ? formatDate(selectedDate, locale)
                  : translate(locale, 'memorableDays')}
              </h3>
            </div>
            {selectedDate && (
              <MoonPhaseBanner
                date={selectedDate}
                className="moon-phase-banner--event-list"
              />
            )}
            {selectedDate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(null)}
              >
                {translate(locale, 'showAllDates')}
              </Button>
            )}
          </div>
          {displayedEvents.map(({ event, date }) => (
            <div className="event-card-admin" key={event.id}>
              <button
                className="event-card"
                type="button"
                onClick={() => setSelectedEvent({ event, date })}
                aria-label={`${event.title}, ${formatDate(date, locale)}`}
              >
                <div className="event-date">
                  <strong>{new Date(`${date}T00:00:00`).getDate()}</strong>
                  <span>
                    {translate(locale, 'monthShort', {
                      month: new Date(`${date}T00:00:00`).getMonth() + 1,
                    })}
                  </span>
                </div>
                <div>
                  <div className="event-card__meta">
                    <Badge variant="outline">
                      {eventTypeLabel(event, locale)}
                    </Badge>
                    <ClanEventIcon event={event} aria-hidden="true" />
                  </div>
                  <h4 className="event-card__title" title={event.title}>
                    {event.title}
                  </h4>
                  <p className="event-card__dates">
                    <CalendarTypeIcon calendar="solar" aria-hidden="true" />{' '}
                    {formatDate(date, locale)}
                    <span className="lunar-chip">
                      {formatLunarDate(date, locale)}
                    </span>
                  </p>
                  {event.location && (
                    <p>
                      <MapPin aria-hidden="true" /> {event.location}
                    </p>
                  )}
                  {event.calendar === 'lunar' && (
                    <small>
                      {translate(locale, 'lunarVerified', {
                        day: event.day,
                        month: event.month,
                      })}
                    </small>
                  )}
                </div>
              </button>
              {admin && (
                <fieldset className="event-card-admin__actions">
                  <legend className="sr-only">
                    {event.title} admin actions
                  </legend>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedEvent(null);
                      admin.onEdit(event);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    {translate(locale, 'adminEditEvent')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={admin.pending}
                    onClick={() => admin.onDelete(event)}
                  >
                    <Trash2 aria-hidden="true" />
                    {translate(locale, 'adminDeleteEvent')}
                  </Button>
                </fieldset>
              )}
            </div>
          ))}
          {!displayedEvents.length && (
            <p className="event-empty">
              {translate(
                locale,
                selectedDate ? 'noEventsForDay' : 'noVerifiedEvents',
              )}
            </p>
          )}
        </aside>
      </div>
      <EventDetail
        event={selectedEvent?.event ?? null}
        date={selectedEvent?.date ?? null}
        locale={locale}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      />
    </section>
  );
}

function LocationsView({
  locations,
  locale,
  pending,
  onAdd,
  onEdit,
  onDelete,
}: {
  locations: ClanLocation[];
  locale: Locale;
  pending: boolean;
  onAdd: () => void;
  onEdit: (location: ClanLocation) => void;
  onDelete: (location: ClanLocation) => void;
}) {
  return (
    <section className="view-panel" aria-labelledby="locations-heading">
      <div className="section-heading locations-heading">
        <div>
          <p className="eyebrow">{translate(locale, 'tabLocations')}</p>
          <h2 id="locations-heading">{translate(locale, 'tabLocations')}</h2>
        </div>
        <div>
          <p>{translate(locale, 'adminLocationsIntro')}</p>
          <Button type="button" onClick={onAdd}>
            <Plus aria-hidden="true" />
            {translate(locale, 'adminAddLocation')}
          </Button>
        </div>
      </div>
      {locations.length ? (
        <div className="locations-grid">
          {locations.map((location) => (
            <article className="location-card" key={location.id}>
              <div className="location-card__icon">
                <MapPin aria-hidden="true" />
              </div>
              <div className="location-card__body">
                <h3>{location.name}</h3>
                <p>{location.address || translate(locale, 'unknown')}</p>
                {location.googleMapUrl && (
                  <a
                    href={location.googleMapUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {translate(locale, 'openMap')}
                    <ExternalLink aria-hidden="true" />
                  </a>
                )}
              </div>
              <fieldset className="location-card__actions">
                <legend className="sr-only">
                  {location.name} admin actions
                </legend>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(location)}
                >
                  <Pencil aria-hidden="true" />
                  {translate(locale, 'adminEditLocation')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => onDelete(location)}
                >
                  <Trash2 aria-hidden="true" />
                  {translate(locale, 'adminDeleteLocation')}
                </Button>
              </fieldset>
            </article>
          ))}
        </div>
      ) : (
        <output className="empty-state">
          <MapPin aria-hidden="true" />
          <h3>{translate(locale, 'noLocation')}</h3>
          <p>{translate(locale, 'adminLocationsIntro')}</p>
        </output>
      )}
    </section>
  );
}

function MemberDetail({
  member,
  members,
  locale,
  onOpenChange,
  admin,
}: {
  member: Member | null;
  members: Member[];
  locale: Locale;
  onOpenChange: (open: boolean) => void;
  admin?: {
    pending: boolean;
    editing: boolean;
    onEdit: (member: Member) => void;
    onDelete: (member: Member) => void;
    onAvatarSave: (
      member: Member,
      input: Pick<AdminMemberInput, 'avatarStyle' | 'avatarImageUrl'>,
    ) => Promise<boolean>;
    onCancelEdit: () => void;
    onSubmit: (
      input: AdminMemberInput,
      siblingOrderIds?: string[],
    ) => Promise<void>;
  };
}) {
  if (!member) return null;
  const related = getRelatives(member, members);
  const isEditing = admin?.editing ?? false;
  return (
    <Sheet open={Boolean(member)} onOpenChange={onOpenChange}>
      <SheetContent className="member-sheet">
        <SheetHeader className="member-sheet__header">
          <MemberAvatar member={member} />
          <div>
            {member.branch && (
              <SheetDescription>{member.branch}</SheetDescription>
            )}
            <SheetTitle>{member.fullName}</SheetTitle>
            {member.familiarName && (
              <p className="familiar-name">
                {translate(locale, 'familiarName', {
                  name: member.familiarName,
                })}
              </p>
            )}
          </div>
        </SheetHeader>
        {admin && !isEditing && (
          <fieldset className="member-sheet__actions">
            <legend className="sr-only">{member.fullName} admin actions</legend>
            <AdminAvatarPicker
              member={member}
              pending={admin.pending}
              onSave={(input) => admin.onAvatarSave(member, input)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={admin.pending}
              onClick={() => admin.onEdit(member)}
            >
              <Pencil aria-hidden="true" />
              {translate(locale, 'adminEditMember')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={admin.pending}
              onClick={() => admin.onDelete(member)}
            >
              <Trash2 aria-hidden="true" />
              {translate(locale, 'adminDeleteMember')}
            </Button>
          </fieldset>
        )}
        {isEditing && admin ? (
          <div className="member-sheet__form">
            <AdminMemberForm
              key={member.id}
              member={member}
              members={members}
              pending={admin.pending}
              onCancel={admin.onCancelEdit}
              onSubmit={admin.onSubmit}
            />
          </div>
        ) : (
          <div className="member-sheet__content">
            <div className="detail-status">
              <Badge
                variant={member.status === 'living' ? 'secondary' : 'outline'}
              >
                {translate(
                  locale,
                  member.status === 'deceased'
                    ? 'deceased'
                    : member.status === 'living'
                      ? 'living'
                      : 'unknown',
                )}
              </Badge>
              {member.residence && (
                <span>
                  <MapPin aria-hidden="true" />
                  {member.residence}
                </span>
              )}
            </div>
            <dl className="detail-list">
              <div>
                <dt>{translate(locale, 'age')}</dt>
                <dd>{formatMemberAge(member)}</dd>
              </div>
              <div>
                <dt>{translate(locale, 'birthYear')}</dt>
                <dd>{member.birthYear ?? translate(locale, 'unknown')}</dd>
              </div>
              <div>
                <dt>{translate(locale, 'birthDate')}</dt>
                <dd>{formatDate(member.birthDate, locale)}</dd>
              </div>
              {member.deathYear !== undefined && (
                <div>
                  <dt>{translate(locale, 'deathYear')}</dt>
                  <dd>{member.deathYear}</dd>
                </div>
              )}
              {member.deathDate && (
                <div>
                  <dt>{translate(locale, 'deathDate')}</dt>
                  <dd>{formatDate(member.deathDate, locale)}</dd>
                </div>
              )}
              {member.deathAnniversaryLunar && (
                <div>
                  <dt>{translate(locale, 'deathAnniversaryField')}</dt>
                  <dd>
                    {translate(locale, 'lunarDate', {
                      day: member.deathAnniversaryLunar.day,
                      month: member.deathAnniversaryLunar.month,
                    })}
                  </dd>
                </div>
              )}
              {member.hometown && (
                <div>
                  <dt>{translate(locale, 'hometown')}</dt>
                  <dd>{member.hometown}</dd>
                </div>
              )}
            </dl>
            {member.biography && (
              <div className="biography">
                <p className="eyebrow">{translate(locale, 'biography')}</p>
                <p>{member.biography}</p>
              </div>
            )}
            <div className="relationships">
              <p className="eyebrow">{translate(locale, 'relationships')}</p>
              {related.map((person) => (
                <div key={person.id}>
                  <MemberAvatar member={person} small />
                  <span>
                    <strong>{person.fullName}</strong>
                    <small>
                      {describeRelationship(member, person, members, locale)}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function adminErrorMessage(error: unknown) {
  if (error instanceof AdminApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The admin request failed.';
}

export function ClanArchive({
  clanDisplayName,
  members,
  events,
  locations = [],
  isSampleData = false,
}: {
  clanDisplayName?: string;
  members: Member[];
  events: ClanEvent[];
  locations?: ClanLocation[];
  isSampleData?: boolean;
}) {
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [readingSize, setReadingSize] = useState<ReadingSize>('standard');
  const [adminStatus, setAdminStatus] = useState<
    'checking' | 'anonymous' | 'loading' | 'authenticated'
  >('checking');
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [adminPending, setAdminPending] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ClanEvent | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<ClanLocation | null>(
    null,
  );
  const isAdmin = adminStatus === 'authenticated' && Boolean(adminData);
  const displayedMembers = isAdmin ? (adminData?.members ?? members) : members;
  const displayedEvents = isAdmin ? (adminData?.events ?? events) : events;
  const displayedLocations = isAdmin ? (adminData?.locations ?? []) : locations;
  const visibleTabs = isAdmin ? tabs : tabs.slice(0, 3);

  async function loadAdminData() {
    if (!adminData) setAdminStatus('loading');
    const data = await fetchAdminData();
    setAdminData(data);
    setAdminStatus('authenticated');
    setAdminError('');
  }

  useEffect(() => {
    let mounted = true;
    getAdminSession()
      .then((session) => {
        if (!mounted) return;
        if (!session.authenticated) {
          setAdminStatus('anonymous');
          return;
        }
        void fetchAdminData()
          .then((data) => {
            if (!mounted) return;
            setAdminData(data);
            setAdminStatus('authenticated');
          })
          .catch(() => {
            if (mounted) setAdminStatus('anonymous');
          });
      })
      .catch(() => {
        if (mounted) setAdminStatus('anonymous');
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const hash = window.location.hash.slice(1);
      const allowedTabs = isAdmin ? tabs : tabs.slice(0, 3);
      setActiveTab(
        allowedTabs.some((tab) => tab.value === hash) ? hash : 'calendar',
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [isAdmin]);

  useEffect(() => {
    document.documentElement.dataset.appReady = 'true';
    return () => {
      delete document.documentElement.dataset.appReady;
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    const stored = normalizeReadingSize(
      window.localStorage.getItem(READING_SIZE_STORAGE_KEY),
    );
    const frame = requestAnimationFrame(() => setReadingSize(stored));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.readingSize = readingSize;
    window.localStorage.setItem(READING_SIZE_STORAGE_KEY, readingSize);
  }, [readingSize]);
  function changeTab(value: string) {
    setActiveTab(value);
    window.history.replaceState(null, '', `#${value}`);
  }

  async function runAdminMutation(action: () => Promise<unknown>) {
    setAdminPending(true);
    setAdminError('');
    try {
      await action();
      await loadAdminData();
      return true;
    } catch (error) {
      setAdminError(adminErrorMessage(error));
      return false;
    } finally {
      setAdminPending(false);
    }
  }

  function openMemberEditor(member: Member | null = null) {
    setEditingMember(member);
    if (member) {
      setSelectedMember(member);
      setAddMemberDialogOpen(false);
    } else {
      setSelectedMember(null);
      setAddMemberDialogOpen(true);
    }
  }

  function openEventEditor(event: ClanEvent | null = null) {
    setEditingEvent(event);
    setEventDialogOpen(true);
  }

  function openLocationEditor(location: ClanLocation | null = null) {
    setEditingLocation(location);
    setLocationDialogOpen(true);
  }

  async function saveMember(
    input: AdminMemberInput,
    siblingOrderIds?: string[],
  ) {
    const saved = await runAdminMutation(async () => {
      if (editingMember) await updateMember(editingMember.id, input);
      else await createMember(input);
      if (siblingOrderIds?.length) await reorderSiblings(siblingOrderIds);
    });
    if (saved) {
      setAddMemberDialogOpen(false);
      setEditingMember(null);
    }
  }

  async function saveAvatar(
    member: Member,
    input: Pick<AdminMemberInput, 'avatarStyle' | 'avatarImageUrl'>,
  ) {
    return runAdminMutation(() => updateMember(member.id, input));
  }

  async function saveInlineSiblingOrder(member: Member, order: number) {
    return runAdminMutation(() =>
      updateMember(member.id, { siblingOrder: order }),
    );
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Delete ${member.fullName}?`)) return;
    const deleted = await runAdminMutation(() => deleteMember(member.id));
    if (deleted && selectedMember?.id === member.id) setSelectedMember(null);
  }

  async function saveEvent(input: AdminEventInput) {
    const saved = await runAdminMutation(() =>
      editingEvent ? updateEvent(editingEvent.id, input) : createEvent(input),
    );
    if (saved) setEventDialogOpen(false);
  }

  async function removeEvent(event: ClanEvent) {
    if (!window.confirm(`Delete ${event.title}?`)) return;
    await runAdminMutation(() => deleteEvent(event.id));
  }

  async function saveLocation(input: AdminLocationInput) {
    const saved = await runAdminMutation(() =>
      editingLocation
        ? updateLocation(editingLocation.id, input)
        : createLocation(input),
    );
    if (saved) setLocationDialogOpen(false);
  }

  async function removeLocation(location: ClanLocation) {
    if (!window.confirm(`Delete ${location.name}?`)) return;
    await runAdminMutation(() => deleteLocation(location.id));
  }

  async function logout() {
    await logoutAdmin();
    setAdminData(null);
    setAdminStatus('anonymous');
    if (activeTab === 'locations') changeTab('calendar');
  }
  return (
    <main className="archive-shell">
      <header className="site-header">
        <div className="brand-mark">
          <Image
            src="./clan-emblem.png"
            alt=""
            aria-hidden="true"
            width={1024}
            height={1024}
            unoptimized
          />
        </div>
        <div className="brand-copy">
          <p>{translate(locale, 'brandKicker')}</p>
          <h1>
            {clanDisplayName
              ? translate(locale, 'clanTitle', { name: clanDisplayName })
              : translate(locale, 'brandTitle')}
          </h1>
        </div>
        <div className="header-tools">
          <div className="preference-controls">
            <fieldset className="language-control">
              <legend className="control-label">
                {translate(locale, 'languageLabel')}
              </legend>
              <select
                className="preference-select"
                aria-label={translate(locale, 'languageLabel')}
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
              <div className="preference-buttons">
                {LOCALES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={
                      value === 'vi'
                        ? 'Tiếng Việt'
                        : value === 'en'
                          ? 'English'
                          : 'Français'
                    }
                    aria-pressed={locale === value}
                    onClick={() => setLocale(value)}
                  >
                    {value.toUpperCase()}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="reading-control">
              <legend className="control-label">
                {translate(locale, 'readingSizeLabel')}
              </legend>
              <select
                className="preference-select"
                aria-label={translate(locale, 'readingSizeLabel')}
                value={readingSize}
                onChange={(event) =>
                  setReadingSize(event.target.value as ReadingSize)
                }
              >
                <option value="standard">
                  {translate(locale, 'readingStandard')}
                </option>
                <option value="large">
                  {translate(locale, 'readingLarge')}
                </option>
                <option value="extra-large">
                  {translate(locale, 'readingExtraLarge')}
                </option>
              </select>
              <div className="preference-buttons">
                {(
                  [
                    ['standard', 'A', 'readingStandard'],
                    ['large', 'A+', 'readingLarge'],
                    ['extra-large', 'A++', 'readingExtraLarge'],
                  ] as const
                ).map(([value, shortLabel, labelKey]) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={translate(locale, labelKey)}
                    aria-pressed={readingSize === value}
                    onClick={() => setReadingSize(value)}
                  >
                    {shortLabel}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <ThemeToggle locale={locale} />
        </div>
      </header>
      {isAdmin && adminError && (
        <p className="admin-error admin-error--banner" role="alert">
          {adminError}
        </p>
      )}
      <Tabs
        value={activeTab}
        onValueChange={changeTab}
        className="archive-tabs"
      >
        <TabsList
          className="main-nav"
          aria-label={translate(locale, 'navigationLabel')}
        >
          {visibleTabs.map(({ value, labelKey, icon: Icon }) => (
            <TabsTrigger key={value} value={value}>
              <Icon aria-hidden="true" />
              {translate(locale, labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="members">
          <MembersView
            members={displayedMembers}
            locale={locale}
            onSelect={setSelectedMember}
            admin={
              isAdmin
                ? {
                    pending: adminPending,
                    onAdd: () => openMemberEditor(),
                    onSiblingOrderSave: saveInlineSiblingOrder,
                  }
                : undefined
            }
          />
        </TabsContent>
        <TabsContent value="tree">
          <TreeView
            members={displayedMembers}
            locale={locale}
            onSelect={setSelectedMember}
            admin={
              isAdmin
                ? {
                    pending: adminPending,
                    onSave: async (memberIds) => {
                      await runAdminMutation(() => reorderSiblings(memberIds));
                    },
                  }
                : undefined
            }
          />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView
            events={displayedEvents}
            locale={locale}
            admin={
              isAdmin
                ? {
                    pending: adminPending,
                    onAdd: () => openEventEditor(),
                    onEdit: openEventEditor,
                    onDelete: (event) => void removeEvent(event),
                  }
                : undefined
            }
          />
        </TabsContent>
        <TabsContent value="locations">
          {isAdmin && (
            <LocationsView
              locations={displayedLocations}
              locale={locale}
              pending={adminPending}
              onAdd={() => openLocationEditor()}
              onEdit={openLocationEditor}
              onDelete={(location) => void removeLocation(location)}
            />
          )}
        </TabsContent>
      </Tabs>
      <footer className="site-footer">
        <span>
          <Flower2 aria-hidden="true" /> {translate(locale, 'footerBrand')}
        </span>
        <p>
          {translate(locale, isSampleData ? 'footerSampleNote' : 'footerNote')}
        </p>
        <ArchiveAdminAccess
          locale={locale}
          authenticated={isAdmin}
          onAuthenticated={loadAdminData}
          onLogout={logout}
        />
      </footer>
      <MemberDetail
        member={
          selectedMember
            ? (displayedMembers.find(
                (member) => member.id === selectedMember.id,
              ) ?? selectedMember)
            : null
        }
        members={displayedMembers}
        locale={locale}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMember(null);
            setEditingMember(null);
          }
        }}
        admin={
          isAdmin
            ? {
                pending: adminPending,
                editing: editingMember?.id === selectedMember?.id,
                onEdit: openMemberEditor,
                onDelete: (member) => void removeMember(member),
                onAvatarSave: saveAvatar,
                onCancelEdit: () => setEditingMember(null),
                onSubmit: saveMember,
              }
            : undefined
        }
      />
      {isAdmin && (
        <>
          <Dialog
            open={addMemberDialogOpen}
            onOpenChange={setAddMemberDialogOpen}
          >
            <DialogContent className="admin-dialog">
              <DialogHeader>
                <DialogTitle>{translate(locale, 'adminAddMember')}</DialogTitle>
                <DialogDescription>
                  {translate(locale, 'memberIntro')}
                </DialogDescription>
              </DialogHeader>
              <AdminMemberForm
                key="new-member"
                member={null}
                members={displayedMembers}
                pending={adminPending}
                onCancel={() => setAddMemberDialogOpen(false)}
                onSubmit={saveMember}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
            <DialogContent className="admin-dialog">
              <DialogHeader>
                <DialogTitle>
                  {translate(
                    locale,
                    editingEvent ? 'adminEditEvent' : 'adminAddEvent',
                  )}
                </DialogTitle>
                <DialogDescription>
                  {translate(locale, 'eventDetailsIntro')}
                </DialogDescription>
              </DialogHeader>
              <AdminEventForm
                key={editingEvent?.id ?? 'new-event'}
                event={editingEvent}
                members={displayedMembers}
                locations={displayedLocations}
                pending={adminPending}
                onCancel={() => setEventDialogOpen(false)}
                onSubmit={saveEvent}
              />
            </DialogContent>
          </Dialog>
          <Dialog
            open={locationDialogOpen}
            onOpenChange={setLocationDialogOpen}
          >
            <DialogContent className="admin-dialog admin-dialog--compact">
              <DialogHeader>
                <DialogTitle>
                  {translate(
                    locale,
                    editingLocation ? 'adminEditLocation' : 'adminAddLocation',
                  )}
                </DialogTitle>
                <DialogDescription>
                  {translate(locale, 'adminLocationsIntro')}
                </DialogDescription>
              </DialogHeader>
              <AdminLocationForm
                key={editingLocation?.id ?? 'new-location'}
                location={editingLocation}
                pending={adminPending}
                onCancel={() => setLocationDialogOpen(false)}
                onSubmit={saveLocation}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </main>
  );
}
