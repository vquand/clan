'use client';

import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ClanArchive } from '@/components/clan-archive';
import { Button } from '@/components/ui/button';
import { fetchClanData, getClanApiEndpoint } from '@/lib/clan-api';
import type { ClanData } from '@/lib/clan-contract';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: ClanData; isSample: boolean }
  | { status: 'error' };

function DataLoadState({
  status,
  onRetry,
}: {
  status: 'loading' | 'error';
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
          {isLoading ? 'Đang tải gia phả' : 'Không thể tải dữ liệu gia phả'}
        </h1>
        <p>
          {isLoading
            ? 'Đang kết nối đến cơ sở dữ liệu…'
            : 'Máy chủ dữ liệu hiện chưa phản hồi. Vui lòng thử lại.'}
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
  sampleData,
  remoteDataEnabled,
}: {
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
      .then((data) => setState({ status: 'ready', data, isSample: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        console.error('Unable to load the clan archive from the API', error);
        setState({ status: 'error' });
      });

    return () => controller.abort();
  }, [attempt, endpoint]);

  if (state.status !== 'ready') {
    return (
      <DataLoadState
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
      members={state.data.members}
      events={state.data.events}
      isSampleData={state.isSample}
    />
  );
}
