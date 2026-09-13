import { expect, test, type Page } from '@playwright/test';

import { clanEvents } from '../../data/events';
import { members } from '../../data/members';

async function serveSampleData(page: Page) {
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({ json: { members, events: clanEvents } });
  });
}

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
  await expect(page.getByRole('tab').nth(0)).toHaveText('Lịch họ');
  await expect(page.getByRole('tab').nth(1)).toHaveText('Gia phả');
  await expect(page.getByRole('tab').nth(2)).toHaveText('Thành viên');
  await expect(
    page.getByRole('heading', { name: 'Ngày đáng nhớ' }),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Thành viên' }).click();
  await expect(
    page.getByRole('heading', { name: '10 thành viên · 3 thế hệ' }),
  ).toBeVisible();
  await expect(page.locator('.member-card')).toHaveCount(10);
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
  await expect(page.getByRole('heading', { name: '3 thế hệ' })).toBeVisible();
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
  await expect(
    page.getByRole('heading', { name: 'Ngày đáng nhớ' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tháng sau' }).click();
  await expect(page.locator('.calendar-grid')).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('archive.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
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

test('opens the configured clan record while data is loading', async ({
  page,
}, testInfo) => {
  await page.route('**/api/clan', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ json: { members, events: clanEvents } });
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Đang mở gia phả' }),
  ).toBeVisible();
  await expect(page.getByText('Họ Đỗ Văn', { exact: true })).toBeVisible();
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
