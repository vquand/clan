'use client';

import { KeyRound, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { AdminApiError } from '@/lib/admin-api';
import { ClanApiError } from '@/lib/clan-api';

function guestLoginMessage(error: unknown) {
  if (error instanceof ClanApiError) {
    if (error.status === 401) return 'Mật khẩu chưa đúng. Vui lòng thử lại.';
    if (error.status === 429)
      return 'Đã thử quá nhiều lần. Vui lòng chờ 15 phút rồi thử lại.';
  }
  return 'Chưa thể mở gia phả. Vui lòng thử lại.';
}

function adminLoginMessage(error: unknown) {
  if (error instanceof AdminApiError) {
    if (error.status === 401) return 'Tên đăng nhập hoặc mật khẩu không đúng.';
    if (error.status === 429)
      return 'Đã thử quá nhiều lần. Vui lòng chờ 15 phút rồi thử lại.';
    if (error.status === 503) return 'Quản trị chưa được cấu hình.';
  }
  return 'Chưa thể đăng nhập quản trị. Vui lòng thử lại.';
}

export function GuestAccessGate({
  clanDisplayName,
  onUnlock,
  onAdminUnlock,
}: {
  clanDisplayName?: string;
  onUnlock: (password: string) => Promise<void>;
  onAdminUnlock: (username: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'guest' | 'admin'>('guest');
  const [guestPassword, setGuestPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const guestPasswordRef = useRef<HTMLInputElement>(null);
  const adminUsernameRef = useRef<HTMLInputElement>(null);
  const hasSwitchedMode = useRef(false);

  useEffect(() => {
    if (!hasSwitchedMode.current) return;
    if (mode === 'guest') guestPasswordRef.current?.focus();
    else adminUsernameRef.current?.focus();
  }, [mode]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      if (mode === 'guest') {
        await onUnlock(guestPassword);
      } else {
        await onAdminUnlock(adminUsername, adminPassword);
      }
    } catch (loginError) {
      setError(
        mode === 'guest'
          ? guestLoginMessage(loginError)
          : adminLoginMessage(loginError),
      );
      setPending(false);
    }
  }

  function switchMode() {
    hasSwitchedMode.current = true;
    setMode((current) => (current === 'guest' ? 'admin' : 'guest'));
    setError('');
  }

  const errorId = `${mode}-login-error`;

  return (
    <main className="archive-shell guest-access">
      <ThemeToggle locale="vi" />
      <section
        className="data-load-state guest-access__panel"
        aria-labelledby="guest-title"
      >
        <LockKeyhole aria-hidden="true" />
        <h1 id="guest-title">
          {clanDisplayName
            ? `Gia phả họ ${clanDisplayName}`
            : 'Gia phả dòng họ'}
        </h1>
        {mode === 'admin' && (
          <p className="guest-access__mode-label">Đăng nhập quản trị</p>
        )}
        <form onSubmit={submit}>
          {mode === 'guest' ? (
            <>
              <label className="sr-only" htmlFor="guest-password">
                Mật khẩu gia đình
              </label>
              <div className="guest-access__input">
                <KeyRound aria-hidden="true" />
                <Input
                  id="guest-password"
                  ref={guestPasswordRef}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={guestPassword}
                  onChange={(event) => setGuestPassword(event.target.value)}
                  placeholder="Mật khẩu gia đình"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  disabled={pending}
                />
              </div>
            </>
          ) : (
            <>
              <label className="sr-only" htmlFor="guest-admin-username">
                Tên đăng nhập
              </label>
              <div className="guest-access__input">
                <UserRound aria-hidden="true" />
                <Input
                  id="guest-admin-username"
                  ref={adminUsernameRef}
                  type="text"
                  autoComplete="username"
                  required
                  value={adminUsername}
                  onChange={(event) => setAdminUsername(event.target.value)}
                  placeholder="Tên đăng nhập"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  disabled={pending}
                />
              </div>
              <label className="sr-only" htmlFor="guest-admin-password">
                Mật khẩu quản trị
              </label>
              <div className="guest-access__input">
                <KeyRound aria-hidden="true" />
                <Input
                  id="guest-admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="Mật khẩu quản trị"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  disabled={pending}
                />
              </div>
            </>
          )}
          {error && (
            <p id={errorId} className="guest-access__error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={
              pending ||
              (mode === 'guest'
                ? guestPassword.length === 0
                : adminUsername.length === 0 || adminPassword.length === 0)
            }
          >
            {pending
              ? 'Đang đăng nhập…'
              : mode === 'guest'
                ? 'Mở gia phả'
                : 'Đăng nhập'}
          </Button>
        </form>
        {mode === 'guest' && <small>Thiết bị sẽ ghi nhớ trong 30 ngày.</small>}
      </section>
      <Button
        className="guest-access__mode-switch"
        type="button"
        variant="ghost"
        onClick={switchMode}
        disabled={pending}
      >
        <ShieldCheck aria-hidden="true" />
        {mode === 'guest' ? 'Quản trị' : 'Quay lại mật khẩu gia đình'}
      </Button>
    </main>
  );
}
