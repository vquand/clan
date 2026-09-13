'use client';

import type { SubmitEvent } from 'react';
import Link from 'next/link';
import { useState } from 'react';
import { KeyRound, LockKeyhole } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginAdmin, AdminApiError } from '@/lib/admin-api';

export function AdminLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      await loginAdmin(username, password);
      onAuthenticated();
    } catch (caughtError) {
      setError(
        caughtError instanceof AdminApiError && caughtError.status === 503
          ? 'Admin access is not configured on the backend.'
          : 'The username or password is not correct.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="admin-shell admin-shell--login">
      <section className="admin-login-card" aria-labelledby="admin-login-heading">
        <div className="admin-login-mark" aria-hidden="true">
          <LockKeyhole />
        </div>
        <p className="admin-kicker">Private workspace</p>
        <h1 id="admin-login-heading">Family archive admin</h1>
        <p className="admin-muted">
          Sign in to manage members, relationships, portraits, and family events.
        </p>
        <form className="admin-login-form" onSubmit={submit}>
          <div className="admin-field">
            <label htmlFor="admin-username">Username</label>
            <Input
              id="admin-username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && (
            <p className="admin-error" role="alert">
              <KeyRound aria-hidden="true" /> {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <Link className="admin-back-link" href="/">
          Back to the public archive
        </Link>
      </section>
    </main>
  );
}
