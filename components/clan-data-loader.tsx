'use client';

import { useEffect, useState } from 'react';

import { ClanArchive } from '@/components/clan-archive';
import type { ClanEvent, Member } from '@/data/types';

interface ClanData {
  members: Member[];
  events: ClanEvent[];
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');

function isClanData(value: unknown): value is ClanData {
  if (!value || typeof value !== 'object') return false;
  const data = value as { members?: unknown; events?: unknown };
  return Array.isArray(data.members) && Array.isArray(data.events);
}

export function ClanDataLoader({ fallbackData }: { fallbackData: ClanData }) {
  const [data, setData] = useState(fallbackData);

  useEffect(() => {
    if (!apiUrl) return;

    const controller = new AbortController();
    fetch(`${apiUrl}/api/clan`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`Clan API returned ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((nextData) => {
        if (!isClanData(nextData))
          throw new Error('Clan API returned invalid data');
        setData(nextData);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        console.error('Unable to load the clan archive from the API', error);
      });

    return () => controller.abort();
  }, []);

  return <ClanArchive members={data.members} events={data.events} />;
}
