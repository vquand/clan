import { expect, test } from '@playwright/test';
import type { AdminData } from '../../lib/admin-contract';

const parentId = '00000000-0000-4000-8000-000000000001';
const childId = '00000000-0000-4000-8000-000000000002';

function initialData(): AdminData {
  return {
    members: [
      {
        id: parentId,
        fullName: 'Founder',
        gender: 'male',
        clanRelation: 'lineage',
        generation: 0,
        parentIds: [],
        spouseIds: [],
      },
      {
        id: childId,
        fullName: 'Child',
        gender: 'female',
        clanRelation: 'lineage',
        generation: 1,
        parentIds: [],
        spouseIds: [],
      },
    ],
    events: [],
  };
}

test('admin can sign in and manage relationships and unassigned events', async ({
  page,
}, testInfo) => {
  let authenticated = false;
  let data = initialData();

  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({ json: { authenticated } });
  });
  await page.route('**/api/admin/login', async (route) => {
    authenticated = true;
    await route.fulfill({ json: { authenticated: true } });
  });
  await page.route('**/api/admin/data', async (route) => {
    await route.fulfill({ json: data });
  });
  await page.route('**/api/admin/members', async (route) => {
    const body = route.request().postDataJSON();
    const member = {
      ...body,
      id: '00000000-0000-4000-8000-000000000003',
      generation: 1,
    };
    data = { ...data, members: [...data.members, member] };
    await route.fulfill({ status: 201, json: member });
  });
  await page.route(`**/api/admin/members/${childId}`, async (route) => {
    const body = route.request().postDataJSON();
    data = {
      ...data,
      members: data.members.map((member) =>
        member.id === childId ? { ...member, ...body } : member,
      ),
    };
    await route.fulfill({
      json: data.members.find((member) => member.id === childId),
    });
  });
  await page.route('**/api/admin/events', async (route) => {
    const body = route.request().postDataJSON();
    const event: AdminData['events'][number] = {
      ...body,
      id: '10000000-0000-4000-8000-000000000001',
    };
    data = { ...data, events: [event] };
    await route.fulfill({ status: 201, json: event });
  });
  await page.route('**/api/admin/logout', async (route) => {
    authenticated = false;
    await route.fulfill({ json: { authenticated: false } });
  });

  await page.goto('/admin/');
  await expect(page.getByRole('heading', { name: 'Family archive admin' })).toBeVisible();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Keep the family record current.' })).toBeVisible();

  await page
    .locator('.admin-record')
    .filter({ hasText: 'Child' })
    .getByRole('button', { name: 'Edit' })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Parents').selectOption(parentId);
  await page.getByRole('button', { name: 'Save member' }).click();
  await expect(page.getByText('1 parent')).toBeVisible();

  await page.getByRole('tab', { name: 'Events' }).click();
  await page.getByRole('button', { name: 'Add event' }).click();
  await page.getByLabel('Title *').fill('Open family day');
  await page.getByLabel('Day *').fill('12');
  await page.getByLabel('Month *').fill('10');
  await page.getByRole('button', { name: 'Add event' }).click();
  await expect(page.getByText('Open family day')).toBeVisible();
  await expect(page.getByText('0 related members')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin.png'), fullPage: true });
});
