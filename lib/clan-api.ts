import { isClanData, type ClanData } from './clan-contract.ts';

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export class ClanApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ClanApiError';
    this.status = status;
    this.code = code;
  }
}

async function apiError(response: Response) {
  let payload: ApiErrorBody | null = null;
  try {
    payload = (await response.json()) as ApiErrorBody;
  } catch {
    // The HTTP status still identifies the failure when no JSON is returned.
  }
  return new ClanApiError(
    response.status,
    payload?.error?.message ?? `Clan API returned ${response.status}`,
    payload?.error?.code,
  );
}

export function getClanApiEndpoint(remoteDataEnabled: boolean) {
  return remoteDataEnabled ? '/api/clan' : null;
}

export async function fetchClanData(
  endpoint: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ClanData> {
  const response = await fetcher(endpoint, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw await apiError(response);
  }

  const data: unknown = await response.json();
  if (!isClanData(data)) throw new Error('Clan API returned invalid data');
  return data;
}

export async function loginGuest(
  password: string,
  fetcher: typeof fetch = fetch,
): Promise<{ authenticated: true }> {
  const response = await fetcher('/api/guest/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) throw await apiError(response);

  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('authenticated' in payload) ||
    payload.authenticated !== true
  ) {
    throw new Error('Guest login returned invalid data');
  }
  return { authenticated: true };
}
