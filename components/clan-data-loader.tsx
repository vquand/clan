'use client';

import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ClanArchive } from '@/components/clan-archive';
import { GuestAccessGate } from '@/components/guest-access-gate';
import { Button } from '@/components/ui/button';
import { loginAdmin } from '@/lib/admin-api';
import {
  ClanApiError,
  fetchClanData,
  getClanApiEndpoint,
  loginGuest,
} from '@/lib/clan-api';
import type { ClanData } from '@/lib/clan-contract';
import {
  readCachedClanData,
  writeCachedClanData,
} from '@/lib/offline-clan-cache';

type LoadState =
  | { status: 'loading' }
  | { status: 'locked' }
  | { status: 'ready'; data: ClanData; isSample: boolean }
  | { status: 'error' };

function DataLoadState({
  status,
  clanDisplayName,
  onRetry,
}: {
  status: 'loading' | 'error';
  clanDisplayName?: string;
  onRetry: () => void;
}) {
  const isLoading = status === 'loading';
  return (
    <main className="archive-shell data-load-shell">
      <section
        className="data-load-state"
        role={isLoading ? 'status' : 'alert'}
        aria-live="polite"
      >
        {isLoading ? (
          <LoaderCircle className="data-load-state__spinner" aria-hidden />
        ) : (
          <AlertTriangle aria-hidden />
        )}
        <h1>
          {isLoading
            ? clanDisplayName
              ? `Họ ${clanDisplayName}`
              : 'Gia phả dòng họ'
            : 'Chưa tải được gia phả'}
        </h1>
        <p>
          {isLoading
            ? 'Đang mở gia phả'
            : 'Chưa kết nối được. Bạn thử lại nhé.'}
        </p>
        {!isLoading && (
          <Button type="button" onClick={onRetry}>
            <RefreshCw aria-hidden />
            Thử lại
          </Button>
        )}
      </section>
    </main>
  );
}

export function ClanDataLoader({
  clanDisplayName,
  sampleData,
  remoteDataEnabled,
}: {
  clanDisplayName?: string;
  sampleData: ClanData | null;
  remoteDataEnabled: boolean;
}) {
  const endpoint = getClanApiEndpoint(remoteDataEnabled);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>(() =>
    endpoint
      ? { status: 'loading' }
      : sampleData
        ? { status: 'ready', data: sampleData, isSample: true }
        : { status: 'error' },
  );

  useEffect(() => {
    if (!endpoint) return;

    const controller = new AbortController();
    fetchClanData(endpoint, fetch, controller.signal)
      .then((data) => {
        writeCachedClanData(data);
        setState({ status: 'ready', data, isSample: false });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        if (error instanceof ClanApiError && error.status === 401) {
          setState({ status: 'locked' });
          return;
        }

        // Only transport failures permit the offline copy; HTTP and data errors
        // must not silently show private records after a server-side failure.
        const cachedData =
          error instanceof TypeError ? readCachedClanData() : null;
        if (cachedData) {
          setState({ status: 'ready', data: cachedData, isSample: false });
          return;
        }

        console.error('Unable to load the clan archive from the API', error);
        setState({ status: 'error' });
      });

    return () => controller.abort();
  }, [attempt, endpoint]);

  if (state.status === 'locked') {
    return (
      <GuestAccessGate
        clanDisplayName={clanDisplayName}
        onUnlock={async (password) => {
          await loginGuest(password);
          setState({ status: 'loading' });
          setAttempt((value) => value + 1);
        }}
        onAdminUnlock={async (username, password) => {
          await loginAdmin(username, password);
          setState({ status: 'loading' });
          setAttempt((value) => value + 1);
        }}
      />
    );
  }

  if (state.status !== 'ready') {
    return (
      <DataLoadState
        clanDisplayName={clanDisplayName}
        status={state.status}
        onRetry={() => {
          setState({ status: 'loading' });
          setAttempt((value) => value + 1);
        }}
      />
    );
  }

  return (
    <ClanArchive
      clanDisplayName={clanDisplayName}
      members={state.data.members}
      events={state.data.events}
      locations={state.data.locations}
      isSampleData={state.isSample}
    />
  );
}
