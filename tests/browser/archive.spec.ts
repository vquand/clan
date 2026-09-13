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
  await expect(
    page.getByRole('heading', { name: '10 thành viên qua 3 thế hệ' }),
  ).toBeVisible();
  await expect(page.locator('.member-card')).toHaveCount(10);
  await expect(
    page.getByRole('button', { name: /Nguyễn Văn An/ }).first(),
  ).toHaveClass(/member-card--lineage.*member-card--male/);
  await expect(
    page.getByRole('button', { name: /Trần Thị Mai/ }).first(),
  ).toHaveClass(/member-card--marriage.*member-card--female/);
  await expect(
    page.getByRole('button', { name: /Nguyễn Văn An/ }).first(),
  ).toContainText('Tuổi: [80]');

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
    page.getByRole('heading', { name: '3 thế hệ trong phả hệ' }),
  ).toBeVisible();
  await expect(page.locator('.family-tree')).toContainText('Nguyễn Minh Khánh');
  await expect(page.locator('.tree-roots > li')).toHaveCount(1);
  await expect(
    page.locator('.family-tree').getByText('Trần Thị Mai', { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.locator('.person-pill').filter({ hasText: 'Nguyễn Văn An' }),
  ).toHaveClass(/person-pill--lineage.*person-pill--male/);
  await expect(
    page.locator('.person-pill').filter({ hasText: 'Trần Thị Mai' }),
  ).toHaveClass(/person-pill--marriage.*person-pill--female/);
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

test('language switching works and the reading size persists locally', async ({
  page,
}, testInfo) => {
  await serveSampleData(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');

  const english = page.getByRole('button', { name: 'English' });
  await english.click();
  await expect(english).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('tab', { name: 'Family tree' })).toBeVisible();

  await page.getByRole('button', { name: 'Extra large text' }).click();
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

  await page.getByRole('button', { name: 'Français' }).click();
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
            parentIds: [],
            spouseIds: [],
          },
        ],
        events: [],
      },
    });
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '1 thành viên qua 1 thế hệ' }),
  ).toBeVisible();
  await expect(page.locator('.member-card')).toHaveCount(1);
  await expect(page.getByText('Database Member')).toBeVisible();
  await expect(page.getByText('Nguyễn Văn An')).toHaveCount(0);
  await expect(
    page.getByText('Dữ liệu được tải trực tiếp từ cơ sở dữ liệu gia phả.'),
  ).toBeVisible();
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
    page.getByRole('alert').getByText('Không thể tải dữ liệu gia phả'),
  ).toBeVisible();
  await expect(page.locator('.member-card')).toHaveCount(0);

  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(
    page.getByRole('heading', { name: '10 thành viên qua 3 thế hệ' }),
  ).toBeVisible();
});
