'use client';

import type { SubmitEvent } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ClanLocation } from '@/data/types';
import type { AdminLocationInput } from '@/lib/admin-contract';

interface LocationFormProps {
  location: ClanLocation | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: AdminLocationInput) => Promise<void>;
}

function toForm(location: ClanLocation | null) {
  return {
    name: location?.name ?? '',
    address: location?.address ?? '',
    googleMapUrl: location?.googleMapUrl ?? '',
  };
}

export function AdminLocationForm({
  location,
  pending,
  onCancel,
  onSubmit,
}: LocationFormProps) {
  const [form, setForm] = useState(() => toForm(location));

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name: form.name,
      address: form.address,
      googleMapUrl: form.googleMapUrl || undefined,
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid">
        <div className="admin-field admin-field--wide">
          <label htmlFor="location-name">Name *</label>
          <Input
            id="location-name"
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </div>
        <div className="admin-field admin-field--wide">
          <label htmlFor="location-address">Address</label>
          <Input
            id="location-address"
            value={form.address}
            onChange={(event) =>
              setForm((current) => ({ ...current, address: event.target.value }))
            }
          />
        </div>
        <div className="admin-field admin-field--wide">
          <label htmlFor="location-map-url">Google Maps shared URL</label>
          <Input
            id="location-map-url"
            type="url"
            placeholder="https://maps.google.com/..."
            value={form.googleMapUrl}
            onChange={(event) =>
              setForm((current) => ({ ...current, googleMapUrl: event.target.value }))
            }
          />
        </div>
      </div>
      <div className="admin-form-actions">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : location ? 'Save location' : 'Add location'}
        </Button>
      </div>
    </form>
  );
}
