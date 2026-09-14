import type {
  AdminEventInput,
  AdminLocationInput,
  AdminMemberInput,
  AdminData,
} from './admin-contract';

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export class AdminApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers,
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // The status below is enough when an upstream service returns no JSON.
  }
  if (!response.ok) {
    const error = payload as ApiErrorBody | null;
    throw new AdminApiError(
      response.status,
      error?.error?.message ?? 'The admin request failed',
      error?.error?.code,
    );
  }
  return payload as T;
}

export function getAdminSession() {
  return request<{ authenticated: boolean }>('/api/admin/session');
}

export function loginAdmin(username: string, password: string) {
  return request<{ authenticated: true }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logoutAdmin() {
  return request<{ authenticated: false }>('/api/admin/logout', {
    method: 'POST',
  });
}

export function fetchAdminData() {
  return request<AdminData>('/api/admin/data');
}

export function createMember(input: AdminMemberInput) {
  return request<AdminData['members'][number]>('/api/admin/members', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateMember(id: string, input: Partial<AdminMemberInput>) {
  return request<AdminData['members'][number]>(`/api/admin/members/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function reorderSiblings(memberIds: string[]) {
  return request<AdminData['members']>('/api/admin/siblings/reorder', {
    method: 'POST',
    body: JSON.stringify({ memberIds }),
  });
}

export function deleteMember(id: string) {
  return request<{ deleted: true }>(`/api/admin/members/${id}`, {
    method: 'DELETE',
  });
}

export function createEvent(input: AdminEventInput) {
  return request<AdminData['events'][number]>('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEvent(id: string, input: Partial<AdminEventInput>) {
  return request<AdminData['events'][number]>(`/api/admin/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteEvent(id: string) {
  return request<{ deleted: true }>(`/api/admin/events/${id}`, {
    method: 'DELETE',
  });
}

export function createLocation(input: AdminLocationInput) {
  return request<NonNullable<AdminData['locations']>[number]>('/api/admin/locations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateLocation(id: string, input: AdminLocationInput) {
  return request<NonNullable<AdminData['locations']>[number]>(`/api/admin/locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteLocation(id: string) {
  return request<{ deleted: true }>(`/api/admin/locations/${id}`, {
    method: 'DELETE',
  });
}
