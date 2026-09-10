import { expect, test } from '@playwright/test';

test('member search, profile, tree, and calendar work without browser errors', async ({
  page,
}, testInfo) => {
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
