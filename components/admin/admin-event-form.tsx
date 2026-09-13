'use client';

import type { SubmitEvent } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ClanEvent, ClanLocation, Member } from '@/data/types';
import type { AdminEventInput } from '@/lib/admin-contract';

interface EventFormProps {
  event: ClanEvent | null;
  members: Member[];
  locations: ClanLocation[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: AdminEventInput) => Promise<void>;
}

interface EventFormState {
  title: string;
  type: AdminEventInput['type'];
  calendar: AdminEventInput['calendar'];
  day: string;
  month: string;
  recurrence: AdminEventInput['recurrence'];
  year: string;
  locationMode: '' | 'saved' | 'custom';
  locationId: string;
  locationName: string;
  locationAddress: string;
  locationGoogleMapUrl: string;
  description: string;
  relatedMemberIds: string[];
  solarDates: string;
}

function toForm(event: ClanEvent | null, locations: ClanLocation[]): EventFormState {
  const savedLocation = locations.find((location) => location.id === event?.locationId);
  return {
    title: event?.title ?? '',
    type: event?.type ?? 'gathering',
    calendar: event?.calendar ?? 'solar',
    day: event?.day.toString() ?? '',
    month: event?.month.toString() ?? '',
    recurrence: event?.recurrence ?? 'annual',
    year: event?.year?.toString() ?? '',
    locationMode: event?.locationId ? 'saved' : event?.location ? 'custom' : '',
    locationId: event?.locationId ?? '',
    locationName: event?.location ?? savedLocation?.name ?? '',
    locationAddress: event?.locationAddress ?? savedLocation?.address ?? '',
    locationGoogleMapUrl:
      event?.locationGoogleMapUrl ?? savedLocation?.googleMapUrl ?? '',
    description: event?.description ?? '',
    relatedMemberIds: event?.relatedMemberIds ?? [],
    solarDates: Object.entries(event?.solarDates ?? {})
      .map(([year, date]) => `${year}=${date}`)
      .join('\n'),
  };
}

function parseSolarDates(value: string) {
  const dates: Record<number, string> = {};
  for (const line of value.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const [year, date] = line.split('=').map((item) => item.trim());
    if (year && date) dates[Number(year)] = date;
  }
  return dates;
}

export function AdminEventForm({
  event,
  members,
  locations,
  pending,
  onCancel,
  onSubmit,
}: EventFormProps) {
  const [form, setForm] = useState<EventFormState>(() => toForm(event, locations));
  function setField<Key extends keyof EventFormState>(
    key: Key,
    value: EventFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseLocation(value: string) {
    if (value === 'custom') {
      setForm((current) => ({
        ...current,
        locationMode: 'custom',
        locationId: '',
      }));
      return;
    }
    const selected = locations.find((location) => location.id === value);
    setForm((current) => ({
      ...current,
      locationMode: selected ? 'saved' : '',
      locationId: selected?.id ?? '',
      locationName: selected?.name ?? '',
      locationAddress: selected?.address ?? '',
      locationGoogleMapUrl: selected?.googleMapUrl ?? '',
    }));
  }

  async function submit(eventToSubmit: SubmitEvent<HTMLFormElement>) {
    eventToSubmit.preventDefault();
    const selectedLocation = locations.find(
      (location) => location.id === form.locationId,
    );
    const locationName =
      form.locationMode === 'saved'
        ? selectedLocation?.name ?? form.locationName
        : form.locationMode === 'custom'
          ? form.locationName.trim()
          : '';
    const isKnownLocation = locations.some(
      (location) =>
        location.name.trim().toLocaleLowerCase() === locationName.toLocaleLowerCase(),
    );
    const saveLocation =
      form.locationMode === 'custom' &&
      Boolean(locationName) &&
      !isKnownLocation &&
      window.confirm(`Add "${locationName}" to the important location list?`);
    await onSubmit({
      title: form.title,
      type: form.type,
      calendar: form.calendar,
      day: form.day,
      month: form.month,
      recurrence: form.recurrence,
      year: form.year || undefined,
      location: locationName,
      locationId: form.locationMode === 'saved' ? form.locationId : undefined,
      locationName: locationName || undefined,
      locationAddress: form.locationAddress || undefined,
      locationGoogleMapUrl: form.locationGoogleMapUrl || undefined,
      saveLocation,
      description: form.description || undefined,
      relatedMemberIds: form.relatedMemberIds,
      solarDates: parseSolarDates(form.solarDates),
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid">
        <div className="admin-field admin-field--wide">
          <label htmlFor="event-title">Title *</label>
          <Input
            id="event-title"
            required
            value={form.title}
            onChange={(eventToChange) => setField('title', eventToChange.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="event-type">Type *</label>
          <select
            id="event-type"
            className="admin-select"
            value={form.type}
            onChange={(eventToChange) =>
              setField('type', eventToChange.target.value as EventFormState['type'])
            }
          >
            <option value="gathering">Gathering</option>
            <option value="clan-ceremony">Family ceremony</option>
            <option value="death-anniversary">Death anniversary</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="event-calendar">Calendar *</label>
          <select
            id="event-calendar"
            className="admin-select"
            value={form.calendar}
            onChange={(eventToChange) =>
              setField('calendar', eventToChange.target.value as EventFormState['calendar'])
            }
          >
            <option value="solar">Solar</option>
            <option value="lunar">Lunar</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="event-day">Day *</label>
          <Input
            id="event-day"
            type="number"
            min="1"
            max="31"
            required
            value={form.day}
            onChange={(eventToChange) => setField('day', eventToChange.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="event-month">Month *</label>
          <Input
            id="event-month"
            type="number"
            min="1"
            max="12"
            required
            value={form.month}
            onChange={(eventToChange) => setField('month', eventToChange.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="event-recurrence">Recurrence *</label>
          <select
            id="event-recurrence"
            className="admin-select"
            value={form.recurrence}
            onChange={(eventToChange) =>
              setField(
                'recurrence',
                eventToChange.target.value as EventFormState['recurrence'],
              )
            }
          >
            <option value="annual">Annual</option>
            <option value="once">One time</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="event-year">Year (for one-time events)</label>
          <Input
            id="event-year"
            type="number"
            min="1"
            max="9999"
            value={form.year}
            onChange={(eventToChange) => setField('year', eventToChange.target.value)}
          />
        </div>
        <div className="admin-field admin-field--wide">
          <label htmlFor="event-location">Location</label>
          <select
            id="event-location"
            className="admin-select"
            value={form.locationMode === 'custom' ? 'custom' : form.locationId}
            onChange={(eventToChange) => chooseLocation(eventToChange.target.value)}
          >
            <option value="">No location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
            <option value="custom">Enter a new location…</option>
          </select>
        </div>
        {form.locationMode === 'custom' && (
          <>
            <div className="admin-field admin-field--wide">
              <label htmlFor="event-location-name">Location name *</label>
              <Input
                id="event-location-name"
                required
                value={form.locationName}
                onChange={(eventToChange) =>
                  setField('locationName', eventToChange.target.value)
                }
              />
            </div>
            <div className="admin-field admin-field--wide">
              <label htmlFor="event-location-address">Address</label>
              <Input
                id="event-location-address"
                value={form.locationAddress}
                onChange={(eventToChange) =>
                  setField('locationAddress', eventToChange.target.value)
                }
              />
            </div>
            <div className="admin-field admin-field--wide">
              <label htmlFor="event-location-map-url">Google Maps shared URL</label>
              <Input
                id="event-location-map-url"
                type="url"
                placeholder="https://maps.google.com/..."
                value={form.locationGoogleMapUrl}
                onChange={(eventToChange) =>
                  setField('locationGoogleMapUrl', eventToChange.target.value)
                }
              />
            </div>
          </>
        )}
        <div className="admin-field admin-field--wide">
          <label htmlFor="event-description">Description</label>
          <Textarea
            id="event-description"
            rows={3}
            value={form.description}
            onChange={(eventToChange) => setField('description', eventToChange.target.value)}
          />
        </div>
        <div className="admin-field admin-field--wide">
          <label htmlFor="event-members">Related members</label>
          <select
            id="event-members"
            className="admin-multi-select"
            multiple
            size={Math.min(7, Math.max(3, members.length))}
            value={form.relatedMemberIds}
            onChange={(eventToChange) =>
              setField(
                'relatedMemberIds',
                Array.from(eventToChange.currentTarget.selectedOptions, (option) => option.value),
              )
            }
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </select>
          <small>Select zero or more. Hold Ctrl/Cmd to choose multiple.</small>
        </div>
        <div className="admin-field admin-field--wide">
          <label htmlFor="event-solar-dates">Verified solar dates</label>
          <Textarea
            id="event-solar-dates"
            rows={4}
            placeholder={'One per line, for example:\n2026=2026-09-27'}
            value={form.solarDates}
            onChange={(eventToChange) => setField('solarDates', eventToChange.target.value)}
          />
          <small>Use this for lunar events that need a checked solar date.</small>
        </div>
      </div>
      <div className="admin-form-actions">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : event ? 'Save event' : 'Add event'}
        </Button>
      </div>
    </form>
  );
}
