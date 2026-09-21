'use client';

import { Bell, BellOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  deliverDueEventReminders,
  getDueReminders,
  readReminderState,
  syncUpcomingEventReminders,
} from '@/lib/event-reminders';
import { type Locale, translate } from '@/lib/i18n';
import { getBrowserStorage } from '@/lib/local-storage';
import type { ClanEvent } from '@/data/types';

type NotificationStatus =
  | 'checking'
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied'
  | 'error';

function getNotificationPermission(): NotificationPermission | null {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  ) {
    return null;
  }

  return Notification.permission;
}

export function EventNotificationSettings({
  events,
  locale,
}: {
  events: ClanEvent[];
  locale: Locale;
}) {
  const [status, setStatus] = useState<NotificationStatus>('checking');
  const [isEnabling, setIsEnabling] = useState(false);

  const syncAndNotify = useCallback(async () => {
    const storage = getBrowserStorage();
    const permission = getNotificationPermission();
    if (!storage) return;

    const now = new Date();
    syncUpcomingEventReminders(events, now, storage);
    if (permission !== 'granted') return;

    const due = getDueReminders(readReminderState(storage), now);
    if (due.length === 0) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      await deliverDueEventReminders(
        due,
        locale,
        storage,
        now,
        async (notification) =>
          registration.showNotification(
            notification.title,
            notification.options,
          ),
      );
    } catch {
      setStatus('error');
    }
  }, [events, locale]);

  useEffect(() => {
    const updateFromPermission = () => {
      const permission = getNotificationPermission();
      if (!permission) {
        setStatus('unsupported');
        void syncAndNotify();
        return;
      }

      setStatus(permission);
      void syncAndNotify();
    };
    const updateTimer = window.setTimeout(updateFromPermission, 0);

    const onFocus = () => {
      void syncAndNotify();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearTimeout(updateTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncAndNotify]);

  async function enableNotifications() {
    if (getNotificationPermission() === null) {
      setStatus('unsupported');
      return;
    }

    setIsEnabling(true);
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission);
      if (permission === 'granted') await syncAndNotify();
    } catch {
      setStatus('error');
    } finally {
      setIsEnabling(false);
    }
  }

  if (status === 'checking') return null;

  return (
    <section
      className="notification-settings"
      aria-label={translate(locale, 'notificationTitle')}
    >
      <div className="notification-settings__copy">
        {status === 'denied' || status === 'unsupported' ? (
          <BellOff aria-hidden />
        ) : (
          <Bell aria-hidden />
        )}
        <div>
          <strong>{translate(locale, 'notificationTitle')}</strong>
          <p>{translate(locale, 'notificationDescription')}</p>
        </div>
      </div>
      {status === 'default' && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isEnabling}
          onClick={() => void enableNotifications()}
        >
          {translate(locale, 'notificationEnable')}
        </Button>
      )}
      {status === 'granted' && (
        <output className="notification-settings__status" aria-live="polite">
          {translate(locale, 'notificationEnabled')}
        </output>
      )}
      {status === 'denied' && (
        <output className="notification-settings__status" aria-live="polite">
          {translate(locale, 'notificationDenied')}
        </output>
      )}
      {status === 'unsupported' && (
        <output className="notification-settings__status" aria-live="polite">
          {translate(locale, 'notificationUnsupported')}
        </output>
      )}
      {status === 'error' && (
        <output className="notification-settings__status" aria-live="polite">
          {translate(locale, 'notificationEnableError')}
        </output>
      )}
    </section>
  );
}
