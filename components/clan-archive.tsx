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
import { clanEvents } from '@/data/events';
import { members } from '@/data/members';
import type { ClanEvent, Member } from '@/data/types';
import {
  buildCalendarDays,
  describeRelationship,
  getChildren,
  getEventDate,
  getMember,
  getRelatives,
} from '@/lib/clan';

const tabs = [
  { value: 'members', label: 'Thành viên', icon: Users },
  { value: 'tree', label: 'Gia phả', icon: TreePine },
  { value: 'calendar', label: 'Lịch họ', icon: CalendarDays },
] as const;

const months = [
  'Tháng Một',
  'Tháng Hai',
  'Tháng Ba',
  'Tháng Tư',
  'Tháng Năm',
  'Tháng Sáu',
  'Tháng Bảy',
  'Tháng Tám',
  'Tháng Chín',
  'Tháng Mười',
  'Tháng Mười Một',
  'Tháng Mười Hai',
];
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function initials(name: string) {
  return name
    .split(' ')
    .slice(-2)
    .map((part) => part[0])
    .join('');
}

function formatDate(date?: string) {
  if (!date) return 'Chưa rõ';
  return new Intl.DateTimeFormat('vi-VN', {
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
  return (
    <span
      className={small ? 'member-avatar member-avatar--small' : 'member-avatar'}
      aria-hidden="true"
    >
      {initials(member.fullName)}
    </span>
  );
}

function MemberCard({
  member,
  onSelect,
}: {
  member: Member;
  onSelect: (member: Member) => void;
}) {
  return (
    <button
      className="member-card"
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
          Đời {member.generation} · {member.birthYear} · {member.branch}
        </span>
        <span className="member-card__bottom">
          <span>
            {member.residence ?? member.hometown ?? 'Chưa cập nhật nơi ở'}
          </span>
          <span
            className={
              member.status === 'deceased'
                ? 'status status--memorial'
                : 'status'
            }
          >
            {member.status === 'deceased' ? 'Đã mất' : 'Còn sống'}
          </span>
        </span>
      </span>
    </button>
  );
}

function MembersView({ onSelect }: { onSelect: (member: Member) => void }) {
  const [query, setQuery] = useState('');
  const [generation, setGeneration] = useState<number | 'all'>('all');
  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return members.filter((member) => {
      const matchesText = [
        member.fullName,
        member.familiarName,
        member.branch,
        member.residence,
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase('vi').includes(normalized));
      return (
        matchesText &&
        (generation === 'all' || member.generation === generation)
      );
    });
  }, [generation, query]);

  return (
    <section className="view-panel" aria-labelledby="members-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Danh sách dòng họ</p>
          <h2 id="members-heading">{members.length} thành viên qua 3 thế hệ</h2>
        </div>
        <p>Chọn một người để xem ngày sinh, quan hệ và thông tin tưởng niệm.</p>
      </div>
      <div className="member-toolbar">
        <div className="search-box">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="member-search">
            Tìm thành viên
          </label>
          <Input
            id="member-search"
            type="search"
            value={query}
            onValueChange={setQuery}
            onInputCapture={(event) => setQuery(event.currentTarget.value)}
            placeholder="Tìm theo tên, nơi ở, chi..."
          />
        </div>
        <div className="generation-filter" aria-label="Lọc theo thế hệ">
          {(['all', 1, 2, 3] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={generation === value ? 'default' : 'outline'}
              onClick={() => setGeneration(value)}
            >
              {value === 'all' ? 'Tất cả' : `Đời ${value}`}
            </Button>
          ))}
        </div>
      </div>
      {filteredMembers.length ? (
        <div className="member-grid">
          {filteredMembers.map((member) => (
            <MemberCard key={member.id} member={member} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <output className="empty-state">
          <Sprout aria-hidden="true" />
          <h3>Không tìm thấy thành viên</h3>
          <p>Thử tên khác hoặc chọn lại “Tất cả”.</p>
        </output>
      )}
    </section>
  );
}

function PersonPill({
  member,
  onSelect,
  spouse = false,
}: {
  member?: Member;
  onSelect: (member: Member) => void;
  spouse?: boolean;
}) {
  if (!member) return null;
  return (
    <button
      type="button"
      className={spouse ? 'person-pill person-pill--spouse' : 'person-pill'}
      onClick={() => onSelect(member)}
    >
      <MemberAvatar member={member} small />
      <span>
        <strong>{member.fullName}</strong>
        <small>
          {member.birthYear} ·{' '}
          {member.status === 'deceased' ? 'đã mất' : member.residence}
        </small>
      </span>
    </button>
  );
}

function CoupleNode({
  member,
  onSelect,
}: {
  member: Member;
  onSelect: (member: Member) => void;
}) {
  const spouse = getMember(member.spouseIds[0] ?? '', members);
  return (
    <div className="couple-node">
      <PersonPill member={member} onSelect={onSelect} />
      {spouse && (
        <>
          <span className="union-mark" aria-label="vợ chồng">
            &amp;
          </span>
          <PersonPill member={spouse} onSelect={onSelect} spouse />
        </>
      )}
    </div>
  );
}

function FamilyBranch({
  member,
  onSelect,
  lineage = new Set<string>(),
}: {
  member: Member;
  onSelect: (member: Member) => void;
  lineage?: Set<string>;
}) {
  const nextLineage = new Set(lineage).add(member.id);
  const children = getChildren(member.id, members).filter(
    (child) => !nextLineage.has(child.id),
  );

  return (
    <li>
      <CoupleNode member={member} onSelect={onSelect} />
      {children.length > 0 && (
        <ul>
          {children.map((child) => (
            <FamilyBranch
              key={child.id}
              member={child}
              onSelect={onSelect}
              lineage={nextLineage}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function TreeView({ onSelect }: { onSelect: (member: Member) => void }) {
  const treeScrollRef = useRef<HTMLElement>(null);
  const roots = members.filter((member, index) => {
    if (
      member.parentIds.length > 0 ||
      getChildren(member.id, members).length === 0
    )
      return false;
    if (
      members.some(
        (relative) =>
          relative.parentIds.length > 0 &&
          relative.spouseIds.includes(member.id),
      )
    )
      return false;
    return !members
      .slice(0, index)
      .some(
        (previous) =>
          previous.parentIds.length === 0 &&
          previous.spouseIds.includes(member.id) &&
          getChildren(previous.id, members).length > 0,
      );
  });
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
          <p className="eyebrow">Sơ đồ phả hệ</p>
          <h2 id="tree-heading">{generationCount} thế hệ trong phả hệ</h2>
        </div>
        <p>
          Chọn tên một người để mở hồ sơ. Vuốt ngang để xem đủ sơ đồ trên màn
          hình nhỏ.
        </p>
      </div>
      <section
        className="tree-scroll"
        aria-label="Cây gia phả"
        ref={treeScrollRef}
      >
        <div className="family-tree">
          <ul className="tree-roots">
            {roots.map((root) => (
              <FamilyBranch key={root.id} member={root} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      </section>
      <div className="tree-legend" aria-label="Chú giải">
        <span>
          <i className="legend-dot" /> Thành viên trong họ
        </span>
        <span>
          <i className="legend-dot legend-dot--spouse" /> Dâu / rể
        </span>
        <span>
          <i className="legend-line" /> Quan hệ cha mẹ – con
        </span>
      </div>
    </section>
  );
}

function eventTypeLabel(event: ClanEvent) {
  if (event.type === 'death-anniversary') return 'Ngày giỗ';
  if (event.type === 'clan-ceremony') return 'Lễ họ';
  return 'Sum họp';
}

function CalendarView() {
  const [visible, setVisible] = useState({ year: 2026, month: 8 });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const now = new Date();
      setVisible({ year: now.getFullYear(), month: now.getMonth() });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const days = buildCalendarDays(visible.year, visible.month);
  const datedEvents = clanEvents
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
  return (
    <section className="view-panel" aria-labelledby="calendar-heading">
      <div className="section-heading calendar-heading">
        <div>
          <p className="eyebrow">Ngày chung của gia đình</p>
          <h2 id="calendar-heading">
            {months[visible.month]} {visible.year}
          </h2>
        </div>
        <div className="calendar-actions">
          <Button
            variant="outline"
            size="icon"
            onClick={() => moveMonth(-1)}
            aria-label="Tháng trước"
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
            Hôm nay
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => moveMonth(1)}
            aria-label="Tháng sau"
          >
            <ArrowRight />
          </Button>
        </div>
      </div>
      <div className="calendar-layout">
        <div
          className="calendar-grid"
          aria-label={`${months[visible.month]} ${visible.year}`}
        >
          {weekdays.map((day) => (
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
          aria-label="Các ngày quan trọng trong năm"
        >
          <div>
            <p className="eyebrow">Trong năm {visible.year}</p>
            <h3>Ngày đáng nhớ</h3>
          </div>
          {datedEvents.map(({ event, date }) => (
            <article className="event-card" key={event.id}>
              <div className="event-date">
                <strong>{new Date(`${date}T00:00:00`).getDate()}</strong>
                <span>thg {new Date(`${date}T00:00:00`).getMonth() + 1}</span>
              </div>
              <div>
                <Badge variant="outline">{eventTypeLabel(event)}</Badge>
                <h4>{event.title}</h4>
                <p>
                  <MapPin aria-hidden="true" /> {event.location}
                </p>
                {event.calendar === 'lunar' && (
                  <small>
                    {event.day}/{event.month} âm lịch · ngày dương đã đối chiếu
                  </small>
                )}
              </div>
            </article>
          ))}
          {!datedEvents.length && (
            <p className="event-empty">
              Chưa có ngày dương đã đối chiếu cho các sự kiện âm lịch năm này.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function MemberDetail({
  member,
  onOpenChange,
}: {
  member: Member | null;
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
              Đời {member.generation} · {member.branch}
            </SheetDescription>
            <SheetTitle>{member.fullName}</SheetTitle>
            {member.familiarName && (
              <p className="familiar-name">
                Tên thường gọi: {member.familiarName}
              </p>
            )}
          </div>
        </SheetHeader>
        <div className="member-sheet__content">
          <div className="detail-status">
            <Badge
              variant={member.status === 'deceased' ? 'outline' : 'secondary'}
            >
              {member.status === 'deceased' ? 'Đã mất' : 'Còn sống'}
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
              <dt>Năm sinh</dt>
              <dd>{member.birthYear}</dd>
            </div>
            <div>
              <dt>Ngày sinh</dt>
              <dd>{formatDate(member.birthDate)}</dd>
            </div>
            {member.deathDate && (
              <div>
                <dt>Ngày mất</dt>
                <dd>{formatDate(member.deathDate)}</dd>
              </div>
            )}
            {member.deathAnniversaryLunar && (
              <div>
                <dt>Ngày giỗ</dt>
                <dd>
                  {member.deathAnniversaryLunar.day}/
                  {member.deathAnniversaryLunar.month} âm lịch
                </dd>
              </div>
            )}
            {member.hometown && (
              <div>
                <dt>Quê quán</dt>
                <dd>{member.hometown}</dd>
              </div>
            )}
          </dl>
          {member.biography && (
            <div className="biography">
              <p className="eyebrow">Ghi nhớ</p>
              <p>{member.biography}</p>
            </div>
          )}
          <div className="relationships">
            <p className="eyebrow">Quan hệ trong gia đình</p>
            {related.map((person) => (
              <div key={person.id}>
                <MemberAvatar member={person} small />
                <span>
                  <strong>{person.fullName}</strong>
                  <small>{describeRelationship(member, person, members)}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ClanArchive() {
  const [activeTab, setActiveTab] = useState('members');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
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
  function changeTab(value: string) {
    setActiveTab(value);
    window.history.replaceState(null, '', `#${value}`);
  }
  return (
    <main className="archive-shell">
      <header className="site-header">
        <div className="brand-mark">
          <Flower2 aria-hidden="true" />
        </div>
        <div className="brand-copy">
          <p>Dòng họ chúng ta</p>
          <h1>Gia phả &amp; ngày sum họp</h1>
        </div>
        <div className="header-note">
          <GitCommitHorizontal aria-hidden="true" />
          <span>
            Dữ liệu được gìn giữ
            <br />
            qua từng lần cập nhật
          </span>
        </div>
      </header>
      <Tabs
        value={activeTab}
        onValueChange={changeTab}
        className="archive-tabs"
      >
        <TabsList className="main-nav" aria-label="Nội dung gia phả">
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value}>
              <Icon aria-hidden="true" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="members">
          <MembersView onSelect={setSelectedMember} />
        </TabsContent>
        <TabsContent value="tree">
          <TreeView onSelect={setSelectedMember} />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView />
        </TabsContent>
      </Tabs>
      <footer className="site-footer">
        <span>
          <Flower2 aria-hidden="true" /> Gia phả dòng họ
        </span>
        <p>
          Dữ liệu hiện tại là minh hoạ. Chỉnh sửa trong <code>data/</code> rồi
          commit để xuất bản.
        </p>
      </footer>
      <MemberDetail
        member={selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
      />
    </main>
  );
}
