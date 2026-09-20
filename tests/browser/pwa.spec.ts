import { expect, test } from '@playwright/test';

test('exposes install metadata and registers the app shell service worker', async ({
  page,
}) => {
  await page.route('**/api/clan', async (route) => {
    await route.fulfill({ json: { members: [], events: [] } });
  });
  await page.route('**/api/admin/session', async (route) => {
    await route.fulfill({ json: { authenticated: false } });
  });

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/icons/apple-touch-icon.png',
  );
  await expect(
    page.locator('meta[name="apple-mobile-web-app-capable"]'),
  ).toHaveAttribute('content', 'yes');

  const manifestResponse = await page.request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  expect(manifestResponse.headers()['content-type']).toContain('manifest+json');
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: '/icons/icon-192.png' }),
      expect.objectContaining({ src: '/icons/icon-512.png' }),
    ]),
  );

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration =
            await navigator.serviceWorker?.getRegistration('/');
          return Boolean(
            registration?.active ||
            registration?.waiting ||
            registration?.installing,
          );
        }),
      { timeout: 10_000 },
    )
    .toBe(true);
  expect(pageErrors).toEqual([]);
});
