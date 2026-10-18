import { expect, test } from '@playwright/test';

import { members } from '../../data/members';

const ancestor = {
  ...members[0],
  parentIds: [],
  spouseIds: [],
  deathAnniversaryLunar: { day: 15, month: 8 },
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-22T12:00:00+07:00') });
  await page.route('**/api/clan', (route) =>
    route.fulfill({ json: { members: [ancestor], events: [] } }),
  );
  await page.route('**/api/admin/session', (route) =>
    route.fulfill({ json: { authenticated: false } }),
  );
});

test('member lunar anniversary appears in the calendar and reminders without a manual event', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Xem tất cả ngày' }).click();
  await expect(page.locator('.event-card')).toHaveCount(1);
  await expect(page.locator('.event-card')).toContainText(
    `Giỗ ${ancestor.fullName}`,
  );
  await expect(page.locator('.event-card')).toContainText('15/8');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const reminders = JSON.parse(
          localStorage.getItem('clan-event-reminders-v1') ?? '{}',
        );
        return reminders.schedule?.map((entry: { date: string }) => entry.date);
      }),
    )
    .toEqual(['2026-09-25']);
  const expand = page.getByRole('button', { name: 'Mở rộng lịch' });
  if (await expand.count()) await expand.click();
  await expect(
    page.locator('.calendar-day[data-date="2026-09-25"] .day-event'),
  ).toHaveCount(1);
  await page.locator('.event-card').click();
  await expect(page.getByRole('dialog')).toContainText(
    `Giỗ ${ancestor.fullName}`,
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.event-card')).toContainText(
    `Death anniversary of ${ancestor.fullName}`,
  );
  expect(errors).toEqual([]);
});

test('admin edits an automatic anniversary through its member record', async ({
  page,
}) => {
  await page.route('**/api/admin/session', (route) =>
    route.fulfill({ json: { authenticated: true } }),
  );
  await page.route('**/api/admin/data', (route) =>
    route.fulfill({ json: { members: [ancestor], events: [], locations: [] } }),
  );
  await page.goto('/');
  await expect(page.getByText('Đang ở chế độ quản trị')).toBeVisible();
  await page.getByRole('button', { name: 'Xem tất cả ngày' }).click();
  const actions = page.locator('.event-card-admin__actions');
  await expect(
    actions.getByRole('button', { name: 'Xóa sự kiện' }),
  ).toHaveCount(0);
  await actions.getByRole('button', { name: 'Sửa thành viên' }).click();
  await expect(page.getByRole('dialog')).toContainText(ancestor.fullName);
  await expect(
    page.getByRole('dialog').getByLabel('Lunar anniversary day'),
  ).toHaveValue('15');
});
