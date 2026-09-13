'use client';

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Flower2,
  GitCommitHorizontal,
  MapPin,
  Search,
  Sprout,
  TreePine,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ClanEvent, Member } from '@/data/types';
import {
  buildCalendarDays,
  describeRelationship,
  getChildren,
  getEventDate,
  getGenerationFilters,
  getMember,
  getRelatives,
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
import { formatMemberAge, getMemberAvatarVariant } from '@/lib/member-display';
import {
  normalizeReadingSize,
  READING_SIZE_STORAGE_KEY,
  type ReadingSize,
} from '@/lib/preferences';

const tabs = [
  { value: 'members', labelKey: 'tabMembers', icon: Users },
  { value: 'tree', labelKey: 'tabTree', icon: TreePine },
  { value: 'calendar', labelKey: 'tabCalendar', icon: CalendarDays },
] as const;

function formatDate(date: string | undefined, locale: Locale) {
  if (!date) return translate(locale, 'unknown');
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

function MemberAvatar({
  member,
  small = false,
}: {
  member: Member;
  small?: boolean;
}) {
  const variant = getMemberAvatarVariant(member);
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
        src={`/people-icons/${variant}.png`}
        alt=""
        width={384}
        height={512}
        unoptimized
      />
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
          {translate(locale, 'generation', {
            generation: member.generation,
          })}{' '}
          · <MemberAge member={member} locale={locale} />
          {member.branch ? ` · ${member.branch}` : ''}
        </span>
        <span className="member-card__bottom">
          <span>
            {member.residence ??
              member.hometown ??
              translate(locale, 'unknownResidence')}
          </span>
          <span
            className={
              member.status === 'deceased'
                ? 'status status--memorial'
                : 'status'
            }
          >
            {translate(
              locale,
              member.status === 'deceased'
                ? 'deceased'
                : member.status === 'living'
                  ? 'living'
                  : 'unknown',
            )}
          </span>
        </span>
      </span>
    </button>
  );
}

function MembersView({
  members,
  locale,
  onSelect,
}: {
  members: Member[];
  locale: Locale;
  onSelect: (member: Member) => void;
}) {
  const [query, setQuery] = useState('');
  const [generation, setGeneration] = useState<number | 'all'>('all');
  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(getIntlLocale(locale));
    return members.filter((member) => {
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
      return (
        matchesText &&
        (generation === 'all' || member.generation === generation)
      );
    });
  }, [generation, locale, members, query]);

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
        <div
          className="generation-filter"
          aria-label={translate(locale, 'generationFilter')}
        >
          {getGenerationFilters(members).map((value) => (
            <Button
              key={value}
              type="button"
              variant={generation === value ? 'default' : 'outline'}
              onClick={() => setGeneration(value)}
            >
              {value === 'all'
                ? translate(locale, 'allGenerations')
                : translate(locale, 'generation', { generation: value })}
            </Button>
          ))}
        </div>
      </div>
      {filteredMembers.length ? (
        <div className="member-grid">
          {filteredMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              locale={locale}
              onSelect={onSelect}
            />
          ))}
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

function TreeView({
  members,
  locale,
  onSelect,
}: {
  members: Member[];
  locale: Locale;
  onSelect: (member: Member) => void;
}) {
  const treeScrollRef = useRef<HTMLElement>(null);
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
      <section
        className="tree-scroll"
        aria-label={translate(locale, 'treeLabel')}
        ref={treeScrollRef}
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

function CalendarView({
  events,
  locale,
}: {
  events: ClanEvent[];
  locale: Locale;
}) {
  const [visible, setVisible] = useState({ year: 2026, month: 8 });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const now = new Date();
      setVisible({ year: now.getFullYear(), month: now.getMonth() });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const days = buildCalendarDays(visible.year, visible.month);
  const datedEvents = events
    .map((event) => ({ event, date: getEventDate(event, visible.year) }))
    .filter((item): item is { event: ClanEvent; date: string } =>
      Boolean(item.date),
    );
  function moveMonth(offset: number) {
    setVisible((current) => {
      const date = new Date(current.year, current.month + offset, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }
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
          <Button
            variant="outline"
            onClick={() => {
              const now = new Date();
              setVisible({ year: now.getFullYear(), month: now.getMonth() });
            }}
          >
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
        </div>
      </div>
      <div className="calendar-layout">
        <div className="calendar-grid" aria-label={monthTitle}>
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
            const dayEvents = datedEvents.filter((item) => item.date === iso);
            return (
              <div
                className={
                  inMonth ? 'calendar-day' : 'calendar-day calendar-day--muted'
                }
                key={iso}
              >
                <time dateTime={iso}>{date.getDate()}</time>
                {dayEvents.map(({ event }) => (
                  <div
                    className={`day-event day-event--${event.type}`}
                    key={event.id}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <aside
          className="event-list"
          aria-label={translate(locale, 'importantDatesLabel')}
        >
          <div>
            <p className="eyebrow">
              {translate(locale, 'yearEyebrow', { year: visible.year })}
            </p>
            <h3>{translate(locale, 'memorableDays')}</h3>
          </div>
          {datedEvents.map(({ event, date }) => (
            <article className="event-card" key={event.id}>
              <div className="event-date">
                <strong>{new Date(`${date}T00:00:00`).getDate()}</strong>
                <span>
                  {translate(locale, 'monthShort', {
                    month: new Date(`${date}T00:00:00`).getMonth() + 1,
                  })}
                </span>
              </div>
              <div>
                <Badge variant="outline">{eventTypeLabel(event, locale)}</Badge>
                <h4>{event.title}</h4>
                <p>
                  <MapPin aria-hidden="true" /> {event.location}
                </p>
                {event.calendar === 'lunar' && (
                  <small>
                    {translate(locale, 'lunarVerified', {
                      day: event.day,
                      month: event.month,
                    })}
                  </small>
                )}
              </div>
            </article>
          ))}
          {!datedEvents.length && (
            <p className="event-empty">
              {translate(locale, 'noVerifiedEvents')}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function MemberDetail({
  member,
  members,
  locale,
  onOpenChange,
}: {
  member: Member | null;
  members: Member[];
  locale: Locale;
  onOpenChange: (open: boolean) => void;
}) {
  if (!member) return null;
  const related = getRelatives(member, members);
  return (
    <Sheet open={Boolean(member)} onOpenChange={onOpenChange}>
      <SheetContent className="member-sheet">
        <SheetHeader className="member-sheet__header">
          <MemberAvatar member={member} />
          <div>
            <SheetDescription>
              {translate(locale, 'generation', {
                generation: member.generation,
              })}
              {member.branch ? ` · ${member.branch}` : ''}
            </SheetDescription>
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
      </SheetContent>
    </Sheet>
  );
}

export function ClanArchive({
  members,
  events,
  isSampleData = false,
}: {
  members: Member[];
  events: ClanEvent[];
  isSampleData?: boolean;
}) {
  const [activeTab, setActiveTab] = useState('members');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [readingSize, setReadingSize] = useState<ReadingSize>('standard');
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const hash = window.location.hash.slice(1);
      if (tabs.some((tab) => tab.value === hash)) setActiveTab(hash);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
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
          <h1>{translate(locale, 'brandTitle')}</h1>
        </div>
        <div className="header-tools">
          <div className="header-note">
            <GitCommitHorizontal aria-hidden="true" />
            <span>{translate(locale, 'custodyNote')}</span>
          </div>
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
        </div>
      </header>
      <Tabs
        value={activeTab}
        onValueChange={changeTab}
        className="archive-tabs"
      >
        <TabsList
          className="main-nav"
          aria-label={translate(locale, 'navigationLabel')}
        >
          {tabs.map(({ value, labelKey, icon: Icon }) => (
            <TabsTrigger key={value} value={value}>
              <Icon aria-hidden="true" />
              {translate(locale, labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="members">
          <MembersView
            members={members}
            locale={locale}
            onSelect={setSelectedMember}
          />
        </TabsContent>
        <TabsContent value="tree">
          <TreeView
            members={members}
            locale={locale}
            onSelect={setSelectedMember}
          />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView events={events} locale={locale} />
        </TabsContent>
      </Tabs>
      <footer className="site-footer">
        <span>
          <Flower2 aria-hidden="true" /> {translate(locale, 'footerBrand')}
        </span>
        <p>
          {translate(locale, isSampleData ? 'footerSampleNote' : 'footerNote')}
        </p>
      </footer>
      <MemberDetail
        member={selectedMember}
        members={members}
        locale={locale}
        onOpenChange={(open) => !open && setSelectedMember(null)}
      />
    </main>
  );
}
