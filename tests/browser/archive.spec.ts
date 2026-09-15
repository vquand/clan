import { expect, test, type Page } from '@playwright/test';

import { clanEvents } from '../../data/events';
import { members } from '../../data/members';
import type { AdminData } from '../../lib/admin-contract';

async function serveSampleData(page: Page) {
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({ json: { members, events: clanEvents } });
  });
  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({ json: { authenticated: false } });
  });
}

test('unlocks the archive with one shared family password', async ({
  page,
}) => {
  let unlocked = false;
  await page.route('**/api/clan', async (route) => {
    if (!unlocked) {
      await route.fulfill({
        status: 401,
        json: {
          error: {
            code: 'GUEST_AUTHENTICATION_REQUIRED',
            message: 'Guest authentication is required',
          },
        },
      });
      return;
    }
    await route.fulfill({ json: { members, events: clanEvents } });
  });
  await page.route('**/api/guest/login', async (route) => {
    const body = route.request().postDataJSON() as { password?: string };
    if (body.password !== 'family-password') {
      await route.fulfill({
        status: 401,
        json: {
          error: {
            code: 'INVALID_GUEST_PASSWORD',
            message: 'Invalid guest password',
          },
        },
      });
      return;
    }
    unlocked = true;
    await route.fulfill({ json: { authenticated: true } });
  });
  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({ json: { authenticated: false } });
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Gia phả họ Đỗ Văn' }),
  ).toBeVisible();

  const password = page.getByLabel('Mật khẩu gia đình');
  const accessPanel = page.locator('.guest-access__panel');
  const adminSwitch = page.getByRole('button', { name: 'Quản trị' });
  const panelBox = await accessPanel.boundingBox();
  const adminSwitchBox = await adminSwitch.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(adminSwitchBox).not.toBeNull();
  expect(adminSwitchBox?.y).toBeGreaterThan(
    (panelBox?.y ?? 0) + (panelBox?.height ?? 0),
  );

  await adminSwitch.click();
  await expect(password).toHaveCount(0);
  await expect(page.getByLabel('Tên đăng nhập')).toBeFocused();
  await expect(page.getByLabel('Mật khẩu quản trị')).toBeVisible();

  await page
    .getByRole('button', { name: 'Quay lại mật khẩu gia đình' })
    .click();
  await expect(password).toBeFocused();

  await password.fill('wrong');
  await page.getByRole('button', { name: 'Mở gia phả' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Mật khẩu chưa đúng. Vui lòng thử lại.',
  );

  await password.fill('family-password');
  await page.getByRole('button', { name: 'Mở gia phả' }).click();
  await expect(page.getByRole('heading', { name: 'Họ Đỗ Văn' })).toBeVisible();
});

test('admin can sign in from the shared access screen', async ({ page }) => {
  let authenticated = false;
  await page.route('**/api/clan', async (route) => {
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        json: {
          error: {
            code: 'GUEST_AUTHENTICATION_REQUIRED',
            message: 'Guest authentication is required',
          },
        },
      });
      return;
    }
    await route.fulfill({ json: { members, events: clanEvents } });
  });
  await page.route('**/api/admin/login', async (route) => {
    const body = route.request().postDataJSON() as {
      username?: string;
      password?: string;
    };
    authenticated =
      body.username === 'admin' && body.password === 'admin-password';
    await route.fulfill({
      status: authenticated ? 200 : 401,
      json: authenticated
        ? { authenticated: true }
        : {
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid admin username or password',
            },
          },
    });
  });
  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({ json: { authenticated } });
  });
  await page.route('**/api/admin/data', async (route) => {
    await route.fulfill({
      json: { members, events: clanEvents, locations: [] },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Quản trị' }).click();
  await page.getByLabel('Tên đăng nhập').fill('admin');
  await page.getByLabel('Mật khẩu quản trị').fill('admin-password');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByRole('heading', { name: 'Họ Đỗ Văn' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Địa điểm' })).toBeVisible();
});

test('toggles and remembers dark mode', async ({ page }) => {
  await serveSampleData(page);
  await page.goto('/');

  const darkMode = page.getByRole('button', { name: 'Bật chế độ tối' });
  await expect(darkMode).toBeVisible();
  await darkMode.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(
    page.getByRole('button', { name: 'Bật chế độ sáng' }),
  ).toBeVisible();
  await expect(
    page.evaluate(() => localStorage.getItem('clan-theme')),
  ).resolves.toBe('dark');

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Bật chế độ sáng' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(
    page.getByRole('button', { name: 'Bật chế độ tối' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('keeps lunar date text readable in dark mode', async ({ page }) => {
  await serveSampleData(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Bật chế độ tối' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  const colors = await page.locator('.lunar-chip').evaluateAll((chips) => {
    const foreground = getComputedStyle(document.documentElement)
      .getPropertyValue('--foreground')
      .trim();
    return {
      foreground,
      chipColors: chips.map((chip) => getComputedStyle(chip).color),
    };
  });

  expect(colors.chipColors.length).toBeGreaterThan(0);
  expect(new Set(colors.chipColors)).toEqual(new Set([colors.foreground]));
});

test('member search, profile, tree, and calendar work without browser errors', async ({
  page,
}, testInfo) => {
  await serveSampleData(page);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  await expect(page).toHaveTitle('Họ Đỗ Văn');
  await expect(page.getByRole('heading', { name: 'Họ Đỗ Văn' })).toBeVisible();
  await expect(
    page.getByText('Ghi chép của gia đình', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('tab').nth(0)).toHaveText('Lịch họ');
  await expect(page.getByRole('tab').nth(1)).toHaveText('Gia phả');
  await expect(page.getByRole('tab').nth(2)).toHaveText('Thành viên');
  await expect(page.locator('.calendar-day--today')).toHaveClass(
    /calendar-day--selected/,
  );
  await expect(
    page.locator('.event-list__heading > .moon-phase-banner--event-list'),
  ).toBeVisible();
  await expect(page.locator('.moon-phase-banner__label')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Thành viên' }).click();
  await expect(
    page.getByRole('heading', { name: '10 thành viên · 3 thế hệ' }),
  ).toBeVisible();
  await expect(page.getByText(/^Đời \d+$/)).toHaveCount(0);
  await expect(page.locator('.member-card')).toHaveCount(10);
  await expect(
    page.locator('.member-card').getByText('Còn sống', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('.member-card').getByText('Đã qua đời', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Nguyễn Văn An/ }).first(),
  ).toHaveClass(/member-card--male/);
  await expect(
    page.getByRole('button', { name: /Trần Thị Mai/ }).first(),
  ).toHaveClass(/member-card--female/);
  await expect(
    page.getByRole('button', { name: /Nguyễn Văn An/ }).first(),
  ).not.toHaveClass(/member-card--(lineage|marriage)/);
  await expect(page.getByText('Nội tộc', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Ngoại tộc', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Dâu / rể', { exact: true })).toHaveCount(0);
  const deceasedCard = page
    .getByRole('button', { name: /Nguyễn Văn An/ })
    .first();
  await expect(deceasedCard).toHaveClass(/member-card--deceased/);
  await expect(deceasedCard).toContainText('Tuổi: [80]');
  const deceasedAvatar = deceasedCard.locator('.member-avatar');
  await expect(deceasedAvatar).toHaveClass(/member-avatar--senior-man/);
  await expect(deceasedAvatar).toHaveClass(/member-avatar--deceased/);
  const memorialStyle = await deceasedAvatar.evaluate((element) => {
    const image = element.querySelector('img');
    const style = getComputedStyle(element);
    return {
      height: Number.parseFloat(style.height),
      width: Number.parseFloat(style.width),
      imageFilter: image ? getComputedStyle(image).filter : '',
    };
  });
  expect(memorialStyle.height).toBeGreaterThan(memorialStyle.width);
  expect(memorialStyle.imageFilter).toContain('grayscale');

  const search = page.getByLabel('Tìm thành viên');
  await search.fill('Giang');
  await expect(page.locator('.member-card')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: /Nguyễn Hoài Giang/ }),
  ).toBeVisible();
  await search.fill('');

  await page
    .getByRole('button', { name: /Nguyễn Văn An/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toContainText('12/3 âm lịch');
  await expect(page.getByRole('dialog')).toContainText('Con gái');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('tab', { name: 'Gia phả' }).click();
  await expect(
    page.getByRole('heading', { name: '3 thế hệ', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.family-tree')).toContainText('Nguyễn Minh Khánh');
  await expect(page.locator('.tree-roots > li')).toHaveCount(1);
  await expect(
    page.locator('.family-tree').getByText('Trần Thị Mai', { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.locator('.person-pill').filter({ hasText: 'Nguyễn Văn An' }),
  ).toHaveClass(/person-pill--male/);
  await expect(
    page.locator('.person-pill').filter({ hasText: 'Trần Thị Mai' }),
  ).toHaveClass(/person-pill--female/);
  await expect(
    page.locator('.person-pill').filter({ hasText: 'Nguyễn Văn An' }),
  ).not.toHaveClass(/person-pill--(lineage|marriage)/);
  await expect(
    page
      .locator('.couple-node')
      .filter({ hasText: 'Nguyễn Thị Chi' })
      .locator('.person-pill'),
  ).toHaveText([/Phạm Quốc Hòa/, /Nguyễn Thị Chi/]);
  await expect(
    page.locator('.family-tree').getByText('Lê Thu Lan', { exact: true }),
  ).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath('tree.png'),
    fullPage: true,
  });

  await page.getByRole('tab', { name: 'Lịch họ' }).click();
  await expect(page.locator('.calendar-day--today')).toHaveClass(
    /calendar-day--selected/,
  );
  await page.getByRole('button', { name: 'Tháng sau' }).click();
  await expect(page.locator('.calendar-day--selected')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hôm nay' }).click();
  await expect(page.locator('.calendar-day--today')).toHaveClass(
    /calendar-day--selected/,
  );
  await expect(page.locator('.calendar-grid')).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('archive.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('opens the requested archive tab from the URL hash', async ({ page }) => {
  await serveSampleData(page);
  await page.goto('/#members');
  await expect(page.getByRole('tab', { name: 'Thành viên' })).toHaveAttribute(
    'data-active',
    '',
  );
  await expect(page.getByRole('heading', { name: /thành viên/ })).toBeVisible();
});

test('shows current and previous clan head markers on member avatars', async ({
  page,
}) => {
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({
      json: {
        members: members.map((member) => ({
          ...member,
          isClanHead: member.fullName === 'Trần Thị Mai',
          isPreviousClanHead: member.fullName === 'Nguyễn Văn An',
        })),
        events: clanEvents,
      },
    });
  });

  await page.goto('/');
  await page.getByRole('tab', { name: 'Thành viên' }).click();
  await expect(
    page
      .locator('.member-card')
      .filter({ hasText: 'Trần Thị Mai' })
      .locator('.member-avatar__head-marker--current'),
  ).toBeVisible();
  await expect(
    page
      .locator('.member-card')
      .filter({ hasText: 'Nguyễn Văn An' })
      .locator('.member-avatar__head-marker--previous'),
  ).toBeVisible();
});

test('calendar explains both calendars and opens event details', async ({
  page,
}) => {
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({
      json: {
        members,
        events: clanEvents.map((event) =>
          event.id === 'hop-ho-thang-tu'
            ? {
                ...event,
                locationAddress: '123 Family Road',
                locationGoogleMapUrl: 'https://maps.google.com/?q=family',
              }
            : event,
        ),
      },
    });
  });

  await page.goto('/');
  await expect(page.locator('.calendar-legend')).toContainText('Dương lịch');
  await expect(page.locator('.calendar-legend')).toContainText('Âm lịch');
  await expect(
    page.locator('[data-calendar-icon="solar"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-calendar-icon="lunar"]').first(),
  ).toBeVisible();
  await expect(page.locator('.calendar-day .lunar-chip').first()).toBeVisible();
  await expect(
    page.locator('.day-event [data-calendar-icon="lunar"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('.calendar-day--today .moon-phase-banner'),
  ).toBeVisible();
  await expect(page.locator('.event-list > .moon-phase-banner')).toHaveCount(0);

  await page.getByRole('button', { name: 'Xem tất cả ngày' }).click();

  await page
    .locator('.event-card')
    .filter({ hasText: 'Họp họ đầu hè' })
    .click();
  const eventDialog = page.getByRole('dialog');
  await expect(eventDialog).toContainText('Họp họ đầu hè');
  await expect(eventDialog).toContainText('Dương lịch');
  await expect(eventDialog).toContainText('Âm lịch');
  await expect(
    eventDialog.locator('[data-calendar-icon="solar"]'),
  ).toBeVisible();
  await expect(eventDialog).toContainText('123 Family Road');
  await expect(
    eventDialog.getByRole('link', { name: /Mở trên Google Maps/ }),
  ).toHaveAttribute('href', 'https://maps.google.com/?q=family');
});

test('uses themed icons for common lunar events', async ({ page }) => {
  await serveSampleData(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Xem tất cả ngày' }).click();

  for (const icon of [
    'tet',
    'nguyen-tieu',
    'han-thuc',
    'doan-ngo',
    'vu-lan',
    'trung-thu',
    'tao-quan',
  ]) {
    await expect(
      page.locator(`[data-event-icon="${icon}"]`).first(),
    ).toBeVisible();
  }
});

test('truncates long event names inside calendar cards', async ({ page }) => {
  const now = new Date();
  const longTitle =
    'Ngày hội đại gia đình với tên sự kiện rất dài cần được thu gọn trong ô lịch';
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({
      json: {
        members,
        events: [
          {
            id: 'long-event-name',
            title: longTitle,
            type: 'gathering',
            calendar: 'solar',
            day: now.getDate(),
            month: now.getMonth() + 1,
            recurrence: 'annual',
            relatedMemberIds: [],
            location: '',
          },
        ],
      },
    });
  });

  await page.goto('/');
  const title = page
    .locator('.day-event__title')
    .filter({ hasText: longTitle });
  await expect(title).toBeVisible();
  await expect(title).toHaveCSS('text-overflow', 'ellipsis');
  const dimensions = await title.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
});

test('filters the event list when a calendar day is selected', async ({
  page,
}) => {
  const now = new Date();
  const eventForFirstDay = 'Event on the first day';
  const eventForSecondDay = 'Event on the second day';
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({
      json: {
        members,
        events: [
          {
            id: 'first-day-event',
            title: eventForFirstDay,
            type: 'gathering',
            calendar: 'solar',
            day: 1,
            month: now.getMonth() + 1,
            recurrence: 'annual',
            relatedMemberIds: [],
            location: '',
          },
          {
            id: 'second-day-event',
            title: eventForSecondDay,
            type: 'gathering',
            calendar: 'solar',
            day: 2,
            month: now.getMonth() + 1,
            recurrence: 'annual',
            relatedMemberIds: [],
            location: '',
          },
        ],
      },
    });
  });

  await page.goto('/');
  const firstDay = page
    .locator('.calendar-day')
    .filter({ hasText: eventForFirstDay });
  await firstDay.locator('.calendar-day__select').click();
  await expect(page.locator('.calendar-day--selected')).toHaveCount(1);
  await expect(page.locator('.event-list .event-card')).toHaveCount(1);
  await expect(page.locator('.event-list')).toContainText(eventForFirstDay);
  await expect(page.locator('.event-list')).not.toContainText(
    eventForSecondDay,
  );

  await page.getByRole('button', { name: 'Xem tất cả ngày' }).click();
  await expect(page.locator('.event-list .event-card')).toHaveCount(2);
});

test('opens the configured clan record while data is loading', async ({
  page,
}, testInfo) => {
  await page.route('**/api/clan', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ json: { members, events: clanEvents } });
  });

  await page.goto('/');
  const loadingState = page.locator('.data-load-state');
  await expect(loadingState).toBeVisible();
  await expect(loadingState.locator('h1')).toHaveText('Họ Đỗ Văn');
  await expect(loadingState.locator('p')).toHaveText('Đang mở gia phả');
  await page.screenshot({
    path: testInfo.outputPath('loading.png'),
    fullPage: true,
  });
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
});

test('admin access stays minimal at the bottom of the archive', async ({
  page,
}, testInfo) => {
  await serveSampleData(page);
  await page.goto('/');

  const adminAccess = page.locator('.archive-admin-login');
  await expect(adminAccess).toBeVisible();
  await expect(adminAccess).toHaveAttribute('data-expanded', 'false');
  await expect(
    adminAccess.getByRole('button', { name: 'Quản trị' }),
  ).toBeVisible();
  await expect(adminAccess.getByLabel('Tên đăng nhập')).toHaveCount(0);

  await adminAccess.getByRole('button', { name: 'Quản trị' }).click();

  await expect(adminAccess).toHaveAttribute('data-expanded', 'true');
  await expect(adminAccess.getByLabel('Tên đăng nhập')).toBeVisible();
  await expect(adminAccess.getByLabel('Mật khẩu')).toBeVisible();
  await expect(adminAccess.getByLabel('Tên đăng nhập')).toHaveAttribute(
    'placeholder',
    '',
  );
  await expect(adminAccess.getByLabel('Mật khẩu')).toHaveAttribute(
    'placeholder',
    '',
  );
  await page.screenshot({
    path: testInfo.outputPath('admin-access.png'),
    fullPage: true,
  });
});

test('admin sign-in keeps management controls in the main archive', async ({
  page,
}) => {
  let authenticated = false;
  await serveSampleData(page);
  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({ json: { authenticated } });
  });
  await page.route('**/api/admin/login', async (route) => {
    authenticated = true;
    await route.fulfill({ json: { authenticated: true } });
  });
  await page.route('**/api/admin/data', async (route) => {
    await route.fulfill({
      json: {
        members,
        events: clanEvents,
        locations: [
          {
            id: 'location-1',
            name: 'Nhà thờ họ',
            address: '123 Đường Gia đình',
          },
        ],
      },
    });
  });
  await page.route('**/api/admin/logout', async (route) => {
    authenticated = false;
    await route.fulfill({ json: { authenticated: false } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Quản trị' }).click();
  await page.getByLabel('Tên đăng nhập').fill('admin');
  await page.getByLabel('Mật khẩu').fill('secret');
  await page.getByRole('button', { name: 'Quản trị' }).click();

  await expect(page.getByRole('tab', { name: 'Địa điểm' })).toBeVisible();
  await expect(
    page.getByText('Đang ở chế độ quản trị', { exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Địa điểm' }).click();
  await expect(page.getByRole('heading', { name: 'Địa điểm' })).toBeVisible();
  await expect(page.locator('.location-card')).toContainText('Nhà thờ họ');

  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('tab', { name: 'Địa điểm' })).toHaveCount(0);
});

test('admin can edit members and manage events and locations from the main tabs', async ({
  page,
}) => {
  let data: AdminData = {
    members: members.map((member) => ({
      ...member,
      siblingOrder:
        member.id === 'chi'
          ? 1
          : member.id === 'binh'
            ? 2
            : member.id === 'dung'
              ? 3
              : member.siblingOrder,
    })),
    events: [],
    locations: [],
  };
  let createdCalendar = '';

  await page.route('**/api/clan', async (route) => {
    await route.fulfill({ json: data });
  });
  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({ json: { authenticated: true } });
  });
  await page.route('**/api/admin/data', async (route) => {
    await route.fulfill({ json: data });
  });
  await page.route('**/api/admin/members/*', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const id = route.request().url().split('/').at(-1);
    data = {
      ...data,
      members: data.members.map((member) =>
        member.id === id ? { ...member, ...body } : member,
      ),
    };
    await route.fulfill({
      json: data.members.find((member) => member.id === id),
    });
  });
  await page.route('**/api/admin/events', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    createdCalendar = typeof body.calendar === 'string' ? body.calendar : '';
    const event = {
      ...body,
      id: 'main-event-1',
    } as AdminData['events'][number];
    data = { ...data, events: [...data.events, event] };
    await route.fulfill({ status: 201, json: event });
  });
  await page.route('**/api/admin/locations', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const location = {
      ...body,
      id: 'main-location-1',
    } as NonNullable<AdminData['locations']>[number];
    data = { ...data, locations: [...(data.locations ?? []), location] };
    await route.fulfill({ status: 201, json: location });
  });

  await page.goto('/');
  await page.getByRole('tab', { name: 'Thành viên' }).click();
  await page.getByLabel('Xem anh chị em của').selectOption('chi');
  await expect(page.locator('.member-card-admin')).toHaveCount(3);
  await expect(page.locator('.member-card-admin').nth(0)).toContainText(
    'Nguyễn Thị Chi',
  );
  await expect(page.locator('#member-order-chi')).toHaveValue('1');
  await page.locator('#member-order-chi').fill('2');
  await page.locator('#member-order-chi').press('Enter');
  await expect(page.locator('#member-order-chi')).toHaveValue('2');

  const chiCard = page
    .locator('.member-card-admin')
    .filter({ hasText: 'Nguyễn Thị Chi' });
  await expect(
    chiCard.getByRole('button', { name: 'Sửa thành viên' }),
  ).toHaveCount(0);
  await expect(
    chiCard.getByRole('button', { name: 'Xóa thành viên' }),
  ).toHaveCount(0);
  await chiCard.locator('.member-card').click();
  const chiDetail = page.getByRole('dialog').filter({
    hasText: 'Nguyễn Thị Chi',
  });
  await expect(
    chiDetail.getByRole('button', { name: 'Sửa thành viên' }),
  ).toBeVisible();
  await expect(
    chiDetail.getByRole('button', { name: 'Xóa thành viên' }),
  ).toBeVisible();
  await chiDetail.getByRole('button', { name: 'Sửa thành viên' }).click();
  await expect(page.locator('.member-sheet #member-full-name')).toBeVisible();
  await expect(page.locator('.admin-dialog')).toHaveCount(0);
  const memberControls = page.locator(
    '.member-sheet .admin-form .admin-field > [data-slot="input"]:not([type="file"]), .member-sheet .admin-form .admin-field > .admin-select',
  );
  const controlMetrics = await memberControls.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        height: style.height,
        width: style.width,
        fieldWidth: element.parentElement?.getBoundingClientRect().width ?? 0,
        backgroundColor: style.backgroundColor,
      };
    }),
  );
  expect(new Set(controlMetrics.map((metric) => metric.height))).toEqual(
    new Set(['40px']),
  );
  expect(
    controlMetrics.every(
      (metric) =>
        Math.abs(Number.parseFloat(metric.width) - metric.fieldWidth) < 1,
    ),
  ).toBe(true);
  expect(
    new Set(controlMetrics.map((metric) => metric.backgroundColor)).size,
  ).toBe(1);
  const disabledBackgrounds = await page
    .locator('.member-sheet .admin-form')
    .evaluate((form) => {
      const input = document.createElement('input');
      input.setAttribute('data-slot', 'input');
      input.disabled = true;
      const select = document.createElement('select');
      select.className = 'admin-select';
      select.disabled = true;
      form.append(input, select);
      const colors = [
        getComputedStyle(input).backgroundColor,
        getComputedStyle(select).backgroundColor,
      ];
      input.remove();
      select.remove();
      return colors;
    });
  expect(new Set(disabledBackgrounds).size).toBe(1);
  expect(disabledBackgrounds[0]).not.toBe(controlMetrics[0].backgroundColor);
  const parentsPicker = page.locator('.admin-field:has(#member-parents)');
  await parentsPicker.locator('#member-parents').fill('Nguyễn Văn Dũng');
  await expect(
    page.getByRole('option', { name: 'Nguyễn Văn Dũng' }),
  ).toBeVisible();
  await page.getByRole('option', { name: 'Nguyễn Văn Dũng' }).click();
  await expect(
    parentsPicker.getByText('Nguyễn Văn Dũng', { exact: true }),
  ).toBeVisible();
  await page.locator('#member-spouses').fill('Phạm Gia Linh');
  await expect(
    page.getByRole('option', { name: 'Phạm Gia Linh' }),
  ).toBeVisible();
  await page.getByRole('option', { name: 'Phạm Gia Linh' }).click();
  await expect(
    page
      .locator('.admin-field:has(#member-spouses)')
      .getByText('Phạm Gia Linh', { exact: true }),
  ).toBeVisible();
  await page.locator('#member-full-name').fill('Nguyễn Thị Chi (đã sửa)');
  await page.getByRole('button', { name: 'Save member' }).click();
  await expect(page.locator('.member-sheet #member-full-name')).toBeHidden();
  await expect(page.locator('.member-sheet')).toContainText(
    'Nguyễn Thị Chi (đã sửa)',
  );
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('tab', { name: 'Lịch họ' }).click();
  await page.getByRole('button', { name: 'Thêm sự kiện' }).click();
  const solarCalendar = page.getByRole('radio', { name: 'Solar calendar' });
  const lunarCalendar = page.getByRole('radio', { name: 'Lunar calendar' });
  const solarCalendarOption = page
    .locator('label.admin-calendar-option')
    .filter({ hasText: 'Solar calendar' });
  const lunarCalendarOption = page
    .locator('label.admin-calendar-option')
    .filter({ hasText: 'Lunar calendar' });
  await expect(solarCalendar).toBeVisible();
  await expect(lunarCalendar).toBeVisible();
  await expect(solarCalendarOption.locator('svg')).toBeVisible();
  await expect(lunarCalendarOption.locator('svg')).toBeVisible();
  await expect(solarCalendar).toBeChecked();
  await lunarCalendarOption.click();
  await expect(lunarCalendar).toBeChecked();
  await expect(solarCalendar).not.toBeChecked();
  await page.getByLabel('Title *').fill('Ngày họp mặt mới');
  await page.getByLabel('Day *').fill('14');
  await page.getByLabel('Month *').fill('9');
  await page.getByLabel('Verified solar dates').fill('2026=2026-10-23');
  await page.getByRole('button', { name: 'Add event' }).click();
  await expect.poll(() => createdCalendar).toBe('lunar');
  await expect(page.getByRole('dialog')).toBeHidden();
  const showAllDates = page.getByRole('button', { name: 'Xem tất cả ngày' });
  if (await showAllDates.isVisible()) await showAllDates.click();
  await expect(page.locator('.event-list')).toContainText('Ngày họp mặt mới');

  await page.getByRole('tab', { name: 'Địa điểm' }).click();
  await page.getByRole('button', { name: 'Thêm địa điểm' }).click();
  await page.getByLabel('Name *').fill('Sân nhà mới');
  await page.getByLabel('Address').fill('456 Đường Gia đình');
  await page.getByRole('button', { name: 'Add location' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.location-card')).toContainText('Sân nhà mới');
});

test('admin can drag sibling order in the main tree and save it', async ({
  page,
}) => {
  const soloParent = {
    id: 'solo-parent',
    fullName: 'Solo Parent',
    gender: 'female' as const,
    clanRelation: 'lineage' as const,
    generation: 1,
    parentIds: [],
    spouseIds: [],
  };
  const soloChildren = [
    {
      id: 'solo-child-a',
      fullName: 'Solo Child A',
      gender: 'male' as const,
      clanRelation: 'lineage' as const,
      generation: 2,
      parentIds: ['solo-parent'],
      spouseIds: [],
      siblingOrder: 1,
    },
    {
      id: 'solo-child-b',
      fullName: 'Solo Child B',
      gender: 'female' as const,
      clanRelation: 'lineage' as const,
      generation: 2,
      parentIds: ['solo-parent'],
      spouseIds: [],
      siblingOrder: 2,
    },
  ];
  let data: AdminData = {
    members: [...members, soloParent, ...soloChildren],
    events: clanEvents,
    locations: [],
  };
  let lastOrder: string[] = [];

  await page.route('**/api/clan', async (route) => {
    await route.fulfill({ json: data });
  });
  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({ json: { authenticated: true } });
  });
  await page.route('**/api/admin/data', async (route) => {
    await route.fulfill({ json: data });
  });
  await page.route('**/api/admin/siblings/reorder', async (route) => {
    const body = route.request().postDataJSON() as { memberIds: string[] };
    lastOrder = body.memberIds;
    data = {
      ...data,
      members: data.members.map((member) => {
        const index = body.memberIds.indexOf(member.id);
        return index === -1 ? member : { ...member, siblingOrder: index + 1 };
      }),
    };
    await route.fulfill({
      json: data.members.filter((member) => body.memberIds.includes(member.id)),
    });
  });

  await page.goto('/');
  await page.getByRole('tab', { name: 'Gia phả' }).click();
  await expect(
    page
      .locator('.admin-sibling-order-title')
      .filter({ hasText: 'Children of Nguyễn Văn An and Trần Thị Mai' }),
  ).toBeVisible();
  await expect(
    page
      .locator('.admin-sibling-order-title')
      .filter({ hasText: 'Children of Solo Parent' }),
  ).toBeVisible();
  const editor = page
    .locator('.admin-tree-sibling-groups .admin-sibling-order')
    .first();
  await expect(editor).toBeVisible();
  const namesBefore = await editor
    .locator('.admin-sibling-order-name')
    .allTextContents();
  const handles = editor.getByRole('button', { name: /Reorder/ });
  await handles.last().dragTo(editor.locator('li').first());
  const namesAfter = await editor
    .locator('.admin-sibling-order-name')
    .allTextContents();
  expect(namesAfter).toEqual([namesBefore.at(-1), ...namesBefore.slice(0, -1)]);
  await editor.getByRole('button', { name: 'Save order' }).click();
  await expect.poll(() => lastOrder.length).toBe(namesBefore.length);
  const memberIdByName = new Map(
    members.map((member) => [member.fullName, member.id]),
  );
  expect(lastOrder[0]).toBe(memberIdByName.get(namesBefore.at(-1)!));
});

test('widens tree people pills to display complete Vietnamese names', async ({
  page,
}) => {
  const longName = 'Đỗ Văn Tiền Nguyễn Thị Minh Khánh';
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({
      json: {
        members: [
          {
            id: 'founder',
            fullName: 'Đỗ Văn Tiền',
            gender: 'male',
            clanRelation: 'lineage',
            generation: 0,
            parentIds: [],
            spouseIds: [],
          },
          {
            id: 'descendant',
            fullName: longName,
            gender: 'female',
            clanRelation: 'lineage',
            generation: 1,
            parentIds: ['founder'],
            spouseIds: [],
          },
        ],
        events: [],
      },
    });
  });

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  await page.getByRole('tab', { name: 'Gia phả' }).click();

  const longNamePill = page
    .locator('.person-pill')
    .filter({ hasText: longName });
  await expect(longNamePill).toBeVisible();
  await expect(longNamePill.locator('strong')).toHaveText(longName);
  const dimensions = await longNamePill.evaluate((element) => {
    const name = element.querySelector('strong');
    if (!name) throw new Error('Missing member name');
    return {
      pillWidth: element.getBoundingClientRect().width,
      nameClientWidth: name.getBoundingClientRect().width,
      nameScrollWidth: name.scrollWidth,
    };
  });
  expect(dimensions.pillWidth).toBeGreaterThan(185);
  expect(dimensions.nameScrollWidth).toBeLessThanOrEqual(
    dimensions.nameClientWidth,
  );
});

test('pans the family tree viewport with mouse and touch drags', async ({
  page,
}, testInfo) => {
  const treeMembers = [
    {
      id: 'founder',
      fullName: 'Đỗ Văn Tiền',
      gender: 'male',
      clanRelation: 'lineage',
      generation: 0,
      parentIds: [],
      spouseIds: [],
    },
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `child-${index}`,
      fullName: `Đỗ Văn Thành viên ${index + 1}`,
      gender: index % 2 === 0 ? 'male' : 'female',
      clanRelation: 'lineage',
      generation: 1,
      parentIds: ['founder'],
      spouseIds: [],
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `descendant-${index}`,
      fullName: `Đỗ Văn Hậu duệ ${index + 1}`,
      gender: 'male',
      clanRelation: 'lineage',
      generation: index + 2,
      parentIds: [index === 0 ? 'child-0' : `descendant-${index - 1}`],
      spouseIds: [],
    })),
  ];
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({ json: { members: treeMembers, events: [] } });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  await page.getByRole('tab', { name: 'Gia phả' }).click();

  const viewport = page.locator('.tree-scroll');
  await expect(viewport).toBeVisible();
  await viewport.locator('.person-pill').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  const metricsBefore = await viewport.evaluate((element) => ({
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
    scrollWidth: element.scrollWidth,
    scrollHeight: element.scrollHeight,
  }));
  expect(metricsBefore.scrollWidth).toBeGreaterThan(metricsBefore.clientWidth);
  expect(metricsBefore.scrollHeight).toBeGreaterThan(
    metricsBefore.clientHeight,
  );

  await viewport.scrollIntoViewIfNeeded();
  const box = await viewport.boundingBox();
  if (!box) throw new Error('Tree viewport is missing a bounding box');
  const start = {
    x: box.x + box.width * 0.75,
    y: box.y + box.height * 0.75,
  };
  const end = {
    x: box.x + box.width * 0.25,
    y: box.y + box.height * 0.25,
  };
  if (testInfo.project.name === 'mobile') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...start, id: 1 }],
    });
    for (let step = 1; step <= 5; step += 1) {
      const progress = step / 5;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            id: 1,
            x: start.x + (end.x - start.x) * progress,
            y: start.y + (end.y - start.y) * progress,
          },
        ],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 5 });
    await page.mouse.up();
  }

  const metricsAfter = await viewport.evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
    touchAction: getComputedStyle(element).touchAction,
  }));
  expect(metricsAfter.scrollLeft).toBeGreaterThan(metricsBefore.scrollLeft);
  expect(metricsAfter.scrollTop).toBeGreaterThan(metricsBefore.scrollTop);
  expect(metricsAfter.touchAction).toBe('none');
});

test('language switching works and the reading size persists locally', async ({
  page,
}, testInfo) => {
  await serveSampleData(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');

  if (testInfo.project.name === 'mobile') {
    const languageSelect = page.getByRole('combobox', { name: 'Ngôn ngữ' });
    const readingSizeSelect = page.getByRole('combobox', { name: 'Cỡ chữ' });
    await expect(languageSelect).toBeVisible();
    await expect(readingSizeSelect).toBeVisible();
    await expect(page.locator('.language-control button').first()).toBeHidden();
    await expect(page.locator('.reading-control button').first()).toBeHidden();
    await languageSelect.selectOption('en');
    await page
      .getByRole('combobox', { name: 'Text size' })
      .selectOption('extra-large');
  } else {
    const english = page.getByRole('button', { name: 'English' });
    await english.click();
    await expect(english).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Extra large text' }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('tab', { name: 'Family tree' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute(
    'data-reading-size',
    'extra-large',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('extra-large-text.png'),
    fullPage: true,
  });

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('combobox', { name: 'Language' }).selectOption('fr');
  } else {
    await page.getByRole('button', { name: 'Français' }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('tab', { name: 'Calendrier' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('html')).toHaveAttribute(
    'data-reading-size',
    'extra-large',
  );
});

test('uses API records without rendering the bundled sample first', async ({
  page,
}) => {
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({
      json: {
        members: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            fullName: 'Database Member',
            gender: 'other',
            clanRelation: 'lineage',
            generation: 0,
            avatarStyle: 'style-2',
            parentIds: [],
            spouseIds: [],
          },
        ],
        events: [],
      },
    });
  });

  await page.goto('/');
  await page.getByRole('tab', { name: 'Thành viên' }).click();
  await expect(
    page.getByRole('heading', { name: '1 thành viên · 1 thế hệ' }),
  ).toBeVisible();
  await expect(page.locator('.member-card')).toHaveCount(1);
  await expect(page.getByText('Database Member')).toBeVisible();
  await expect(page.locator('.member-avatar img')).toHaveAttribute(
    'src',
    /unknown-style-2\.png/,
  );
  await expect(page.getByText('Nguyễn Văn An')).toHaveCount(0);
  await expect(
    page.getByText('Thông tin lấy từ gia phả gia đình.'),
  ).toBeVisible();
});

test('calculates age for API members without an explicit life status', async ({
  page,
}) => {
  const currentYear = new Date().getFullYear();
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({
      json: {
        members: [
          {
            id: 'founder',
            fullName: 'Member With Birth Year',
            gender: 'male',
            clanRelation: 'lineage',
            generation: 0,
            birthYear: currentYear - 40,
            parentIds: [],
            spouseIds: ['spouse'],
          },
          {
            id: 'spouse',
            fullName: 'Member Spouse',
            gender: 'female',
            clanRelation: 'marriage',
            generation: 0,
            birthDate: `${currentYear - 39}-01-01`,
            parentIds: [],
            spouseIds: ['founder'],
          },
          {
            id: 'child',
            fullName: 'Member Child',
            gender: 'male',
            clanRelation: 'lineage',
            generation: 1,
            birthYear: currentYear - 10,
            parentIds: ['founder', 'spouse'],
            spouseIds: [],
          },
        ],
        events: [],
      },
    });
  });

  await page.goto('/');
  await page.getByRole('tab', { name: 'Thành viên' }).click();
  await expect(
    page.getByRole('button', { name: /Member With Birth Year/ }),
  ).toContainText('Tuổi: 40');

  await page.getByRole('tab', { name: 'Gia phả' }).click();
  await expect(
    page.locator('.person-pill').filter({ hasText: 'Member With Birth Year' }),
  ).toContainText('Tuổi: 40');
});

test('shows a retryable error instead of mock members when the API fails', async ({
  page,
}) => {
  let requestCount = 0;
  await page.route('**/api/clan', async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.fulfill({ status: 503, body: 'Unavailable' });
      return;
    }
    await route.fulfill({ json: { members, events: clanEvents } });
  });

  await page.goto('/');
  await expect(
    page.getByRole('alert').getByText('Chưa tải được gia phả'),
  ).toBeVisible();
  await expect(page.locator('.member-card')).toHaveCount(0);

  await page.getByRole('button', { name: 'Thử lại' }).click();
  await page.getByRole('tab', { name: 'Thành viên' }).click();
  await expect(
    page.getByRole('heading', { name: '10 thành viên · 3 thế hệ' }),
  ).toBeVisible();
});
