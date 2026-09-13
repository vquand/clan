'use client';

import {
  CalendarDays,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AdminEventForm } from '@/components/admin/admin-event-form';
import { AdminAvatarPicker } from '@/components/admin/admin-avatar-picker';
import { AdminLogin } from '@/components/admin/admin-login';
import { AdminLocationForm } from '@/components/admin/admin-location-form';
import { AdminMemberForm } from '@/components/admin/admin-member-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  logoutAdmin,
  updateEvent,
  updateLocation,
  updateMember,
} from '@/lib/admin-api';
import type {
  AdminEventInput,
  AdminLocationInput,
  AdminMemberInput,
  AdminData,
} from '@/lib/admin-contract';
import type { ClanEvent, ClanLocation, Member } from '@/data/types';

type AdminStatus = 'checking' | 'login' | 'loading' | 'ready' | 'error';
type AdminSection = 'members' | 'events' | 'locations';

function getErrorMessage(error: unknown) {
  if (error instanceof AdminApiError) return error.message;
  return 'The admin service is temporarily unavailable.';
}

function AdminSummary({
  members,
  events,
  locations,
}: {
  members: number;
  events: number;
  locations: number;
}) {
  return (
    <div className="admin-summary" aria-label="Archive totals">
      <div>
        <Users aria-hidden="true" />
        <strong>{members}</strong>
        <span>Members</span>
      </div>
      <div>
        <CalendarDays aria-hidden="true" />
        <strong>{events}</strong>
        <span>Events</span>
      </div>
      <div>
        <MapPin aria-hidden="true" />
        <strong>{locations}</strong>
        <span>Locations</span>
      </div>
    </div>
  );
}

function MemberRecords({
  members,
  query,
  pending,
  onEdit,
  onDelete,
  onAvatarSave,
}: {
  members: Member[];
  query: string;
  pending: boolean;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  onAvatarSave: (
    member: Member,
    input: Pick<AdminMemberInput, 'avatarStyle' | 'avatarImageUrl'>,
  ) => Promise<boolean>;
}) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return members.filter((member) =>
      [member.fullName, member.familiarName, member.residence]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(needle)),
    );
  }, [members, query]);
  if (!filtered.length) {
    return <p className="admin-empty">No members match this search.</p>;
  }
  return (
    <ul className="admin-record-list">
      {filtered.map((member) => (
        <li className="admin-record" key={member.id}>
          <AdminAvatarPicker
            member={member}
            pending={pending}
            onSave={(input) => onAvatarSave(member, input)}
          />
          <div className="admin-record-copy">
            <h3>{member.fullName}</h3>
            <p>
              {member.clanRelation === 'lineage' ? 'Lineage' : 'Joined by marriage'}
              {' · '}
              {member.parentIds.length} parent{member.parentIds.length === 1 ? '' : 's'}
              {' · '}
              {member.spouseIds.length} spouse{member.spouseIds.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="admin-record-actions">
            <Button variant="outline" size="sm" onClick={() => onEdit(member)}>
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${member.fullName}`}
              onClick={() => onDelete(member)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EventRecords({
  events,
  query,
  onEdit,
  onDelete,
}: {
  events: ClanEvent[];
  query: string;
  onEdit: (event: ClanEvent) => void;
  onDelete: (event: ClanEvent) => void;
}) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return events.filter((event) =>
      [event.title, event.location, event.locationAddress, event.description]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(needle)),
    );
  }, [events, query]);
  if (!filtered.length) {
    return <p className="admin-empty">No events match this search.</p>;
  }
  return (
    <ul className="admin-record-list">
      {filtered.map((event) => (
        <li className="admin-record" key={event.id}>
          <span className={`admin-event-icon admin-event-icon--${event.type}`}>
            <CalendarDays aria-hidden="true" />
          </span>
          <div className="admin-record-copy">
            <h3>{event.title}</h3>
            <p>
              {event.day}/{event.month} · {event.calendar} · {event.relatedMemberIds.length}{' '}
              related member{event.relatedMemberIds.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="admin-record-actions">
            <Button variant="outline" size="sm" onClick={() => onEdit(event)}>
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${event.title}`}
              onClick={() => onDelete(event)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function LocationRecords({
  locations,
  query,
  onEdit,
  onDelete,
}: {
  locations: ClanLocation[];
  query: string;
  onEdit: (location: ClanLocation) => void;
  onDelete: (location: ClanLocation) => void;
}) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return locations.filter((location) =>
      [location.name, location.address, location.googleMapUrl]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(needle)),
    );
  }, [locations, query]);
  if (!filtered.length) {
    return <p className="admin-empty">No locations match this search.</p>;
  }
  return (
    <ul className="admin-record-list">
      {filtered.map((location) => (
        <li className="admin-record" key={location.id}>
          <span className="admin-event-icon admin-event-icon--location">
            <MapPin aria-hidden="true" />
          </span>
          <div className="admin-record-copy">
            <h3>{location.name}</h3>
            <p>{location.address || 'No address recorded'}</p>
          </div>
          <div className="admin-record-actions">
            <Button variant="outline" size="sm" onClick={() => onEdit(location)}>
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${location.name}`}
              onClick={() => onDelete(location)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AdminSpace() {
  const [status, setStatus] = useState<AdminStatus>('checking');
  const [data, setData] = useState<AdminData | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>('members');
  const [query, setQuery] = useState('');
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingEvent, setEditingEvent] = useState<ClanEvent | null>(null);
  const [editingLocation, setEditingLocation] = useState<ClanLocation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setStatus('loading');
    try {
      setData(await fetchAdminData());
      setStatus('ready');
      setError('');
    } catch (caughtError) {
      setStatus('error');
      setError(getErrorMessage(caughtError));
    }
  }, []);

  useEffect(() => {
    getAdminSession()
      .then((session) => {
        if (session.authenticated) void loadData();
        else setStatus('login');
      })
      .catch((caughtError) => {
        setStatus('error');
        setError(getErrorMessage(caughtError));
      });
  }, [loadData]);

  async function afterMutation(action: () => Promise<unknown>) {
    setPending(true);
    setError('');
    try {
      await action();
      await loadData();
      setMemberDialogOpen(false);
      setEventDialogOpen(false);
      setLocationDialogOpen(false);
      return true;
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      return false;
    } finally {
      setPending(false);
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.fullName}? Related links will also be removed.`)) return;
    await afterMutation(() => deleteMember(member.id));
  }

  async function removeEvent(event: ClanEvent) {
    if (!window.confirm(`Remove ${event.title}?`)) return;
    await afterMutation(() => deleteEvent(event.id));
  }

  async function removeLocation(location: ClanLocation) {
    if (
      !window.confirm(
        `Remove ${location.name}? Existing events will keep their address snapshot.`,
      )
    )
      return;
    await afterMutation(() => deleteLocation(location.id));
  }

  if (status === 'checking' || status === 'loading') {
    return (
      <main className="admin-shell admin-shell--state">
      <output>Loading admin workspace…</output>
      </main>
    );
  }
  if (status === 'login') return <AdminLogin onAuthenticated={loadData} />;
  if (status === 'error' || !data) {
    return (
      <main className="admin-shell admin-shell--state">
        <section className="admin-state-card" role="alert">
          <ShieldCheck aria-hidden="true" />
          <h1>Admin workspace unavailable</h1>
          <p>{error || 'The backend could not be reached.'}</p>
          <Button onClick={loadData}>Try again</Button>
          <Link className="admin-back-link" href="/">Back to the public archive</Link>
        </section>
      </main>
    );
  }

  const dialogTitle = memberDialogOpen
    ? editingMember
      ? `Edit ${editingMember.fullName}`
      : 'Add a member'
    : eventDialogOpen
      ? editingEvent
        ? `Edit ${editingEvent.title}`
        : 'Add an event'
      : editingLocation
        ? `Edit ${editingLocation.name}`
        : 'Add a location';

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-brand-mark"><ShieldCheck aria-hidden="true" /></span>
          <div>
            <p className="admin-kicker">Private workspace</p>
            <h1>Family archive admin</h1>
          </div>
        </div>
        <div className="admin-header-actions">
          <Link className="admin-back-link" href="/">View public archive</Link>
          <Button
            variant="outline"
            onClick={async () => {
              await logoutAdmin();
              setStatus('login');
            }}
          >
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </div>
      </header>
      <section className="admin-intro" aria-labelledby="admin-heading">
        <div>
          <p className="admin-kicker">Stewardship tools</p>
          <h2 id="admin-heading">Keep the family record current.</h2>
          <p className="admin-muted">
            Maintain people, relationship links, portraits, and dates from one place.
          </p>
        </div>
        <AdminSummary
          members={data.members.length}
          events={data.events.length}
          locations={data.locations?.length ?? 0}
        />
      </section>
      {error && <p className="admin-error admin-error--banner" role="alert">{error}</p>}
      <section className="admin-panel" aria-label="Archive records">
        <div className="admin-panel-toolbar">
          <div className="admin-section-tabs" role="tablist" aria-label="Record type">
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'members'}
              onClick={() => {
                setActiveSection('members');
                setQuery('');
              }}
            >
              <Users aria-hidden="true" /> Members
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'events'}
              onClick={() => {
                setActiveSection('events');
                setQuery('');
              }}
            >
              <CalendarDays aria-hidden="true" /> Events
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'locations'}
              onClick={() => {
                setActiveSection('locations');
                setQuery('');
              }}
            >
              <MapPin aria-hidden="true" /> Locations
            </button>
          </div>
          <div className="admin-toolbar-actions">
            <div className="admin-search">
              <Search aria-hidden="true" />
              <label className="sr-only" htmlFor="admin-search">Search records</label>
              <input
                id="admin-search"
                type="search"
                placeholder={`Search ${activeSection}…`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button
              onClick={() => {
                setError('');
                if (activeSection === 'members') {
                  setEditingMember(null);
                  setMemberDialogOpen(true);
                } else if (activeSection === 'events') {
                  setEditingEvent(null);
                  setEventDialogOpen(true);
                } else {
                  setEditingLocation(null);
                  setLocationDialogOpen(true);
                }
              }}
            >
              <Plus aria-hidden="true" /> Add{' '}
              {activeSection === 'members'
                ? 'member'
                : activeSection === 'events'
                  ? 'event'
                  : 'location'}
            </Button>
          </div>
        </div>
        {activeSection === 'members' ? (
          <MemberRecords
            members={data.members}
            query={query}
            pending={pending}
            onEdit={(member) => {
              setEditingMember(member);
              setMemberDialogOpen(true);
            }}
            onDelete={removeMember}
            onAvatarSave={(member, input) =>
              afterMutation(() => updateMember(member.id, input))
            }
          />
        ) : activeSection === 'events' ? (
          <EventRecords
            events={data.events}
            query={query}
            onEdit={(event) => {
              setEditingEvent(event);
              setEventDialogOpen(true);
            }}
            onDelete={removeEvent}
          />
        ) : (
          <LocationRecords
            locations={data.locations ?? []}
            query={query}
            onEdit={(location) => {
              setEditingLocation(location);
              setLocationDialogOpen(true);
            }}
            onDelete={removeLocation}
          />
        )}
      </section>
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="admin-dialog">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Changes are saved to the private backend immediately.
            </DialogDescription>
          </DialogHeader>
          <AdminMemberForm
            key={editingMember?.id ?? 'new-member'}
            member={editingMember}
            members={data.members}
            pending={pending}
            onCancel={() => setMemberDialogOpen(false)}
            onSubmit={(input: AdminMemberInput) =>
              (async () => {
                await afterMutation(() =>
                  editingMember
                    ? updateMember(editingMember.id, input)
                    : createMember(input),
                );
              })()
            }
          />
        </DialogContent>
      </Dialog>
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="admin-dialog">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Events may be saved with no related members or linked to any number of members.
            </DialogDescription>
          </DialogHeader>
          <AdminEventForm
            key={editingEvent?.id ?? 'new-event'}
            event={editingEvent}
            members={data.members}
            locations={data.locations ?? []}
            pending={pending}
            onCancel={() => setEventDialogOpen(false)}
            onSubmit={(input: AdminEventInput) =>
              (async () => {
                await afterMutation(() =>
                  editingEvent
                    ? updateEvent(editingEvent.id, input)
                    : createEvent(input),
                );
              })()
            }
          />
        </DialogContent>
      </Dialog>
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="admin-dialog">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Save the places that matter to the clan so events can reuse them.
            </DialogDescription>
          </DialogHeader>
          <AdminLocationForm
            key={editingLocation?.id ?? 'new-location'}
            location={editingLocation}
            pending={pending}
            onCancel={() => setLocationDialogOpen(false)}
            onSubmit={(input: AdminLocationInput) =>
              (async () => {
                await afterMutation(() =>
                  editingLocation
                    ? updateLocation(editingLocation.id, input)
                    : createLocation(input),
                );
              })()
            }
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
