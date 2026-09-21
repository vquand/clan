import { expect, test } from '@playwright/test';

import { clanEvents } from '../../data/events';
import { members } from '../../data/members';

test('can enable localized reminders and deliver an event in the T-3 window', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const RealDate = Date;
    const fixedNow = RealDate.parse('2026-09-22T12:00:00+07:00');
    class FixedDate extends RealDate {
      constructor(...args: unknown[]) {
        super();
        this.setTime(
          args.length
            ? Reflect.construct(RealDate, args as never[]).getTime()
            : fixedNow,
        );
      }

      static now() {
        return fixedNow;
      }
    }

    Object.defineProperty(window, 'Date', {
      configurable: true,
      value: FixedDate,
    });

    const calls: Array<{ title: string; options: { body: string } }> = [];
    const notificationApi = {
      permission: 'default',
      requestPermission: async () => {
        notificationApi.permission = 'granted';
        return 'granted';
      },
    };
    const registration = {
      showNotification: async (title: string, options: { body: string }) => {
        calls.push({ title, options });
      },
    };

    Object.defineProperty(window, '__notificationCalls', {
      configurable: true,
      value: calls,
    });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: notificationApi,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve(registration),
        register: async () => registration,
      },
    });
  });

  await page.route('**/api/clan', async (route) => {
    await route.fulfill({
      json: {
        members,
        events: clanEvents,
      },
    });
  });
  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({ json: { authenticated: false } });
  });

  await page.goto('/');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = JSON.parse(
          localStorage.getItem('clan-event-reminders-v1') ?? '{}',
        ) as { schedule?: Array<{ eventId?: string; date?: string }> };
        return state.schedule?.some(
          (entry) =>
            entry.eventId === 'trung-thu' && entry.date === '2026-09-25',
        );
      }),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Bật nhắc lịch' }).click();

  await expect(page.getByText('Đã bật nhắc lịch')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __notificationCalls: unknown[] })
            .__notificationCalls.length,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __notificationCalls: Array<{ options: { body: string } }>;
            }
          ).__notificationCalls[0]?.options.body,
      ),
    )
    .toContain('sẽ diễn ra sau 3 ngày');
});
