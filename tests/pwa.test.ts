import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

type Manifest = {
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  orientation?: string;
  theme_color?: string;
  background_color?: string;
  icons?: Array<{
    src?: string;
    sizes?: string;
    type?: string;
    purpose?: string;
  }>;
};

function readPngDimensions(buffer: Buffer) {
  equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

void test('manifest declares a standalone archive with install icons', async () => {
  const manifest = JSON.parse(
    await readFile(join(projectRoot, 'public/manifest.webmanifest'), 'utf8'),
  ) as Manifest;

  equal(manifest.name, 'Clan Archive');
  equal(manifest.short_name, 'Clan Archive');
  equal(manifest.start_url, '/');
  equal(manifest.scope, '/');
  equal(manifest.display, 'standalone');
  equal(manifest.orientation, 'portrait');
  equal(manifest.theme_color, '#7c2d1e');
  equal(manifest.background_color, '#f8f4ec');

  const icon192 = manifest.icons?.find(
    (icon) => icon.src === '/icons/icon-192.png',
  );
  const icon512 = manifest.icons?.find(
    (icon) => icon.src === '/icons/icon-512.png',
  );
  const maskable = manifest.icons?.find(
    (icon) => icon.src === '/icons/icon-512-maskable.png',
  );

  deepStrictEqual(icon192, {
    src: '/icons/icon-192.png',
    sizes: '192x192',
    type: 'image/png',
  });
  deepStrictEqual(icon512, {
    src: '/icons/icon-512.png',
    sizes: '512x512',
    type: 'image/png',
  });
  deepStrictEqual(maskable, {
    src: '/icons/icon-512-maskable.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  });
});

void test('PWA icons have the dimensions declared in the manifest', async () => {
  for (const [fileName, size] of [
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-512-maskable.png', 512],
  ] as const) {
    const filePath = join(projectRoot, 'public/icons', fileName);
    const file = await readFile(filePath);
    const dimensions = readPngDimensions(file);

    equal(dimensions.width, size);
    equal(dimensions.height, size);
    ok((await stat(filePath)).size > 1_000);
  }
});

void test('service worker keeps private API and mutation requests network-only', async () => {
  const serviceWorker = await readFile(
    join(projectRoot, 'public/sw.js'),
    'utf8',
  );

  ok(serviceWorker.includes("request.method !== 'GET'"));
  ok(serviceWorker.includes("url.pathname.startsWith('/api/')"));
  ok(!serviceWorker.includes('event.respondWith(fetch(request))'));
  ok(serviceWorker.includes('return;'));
  ok(serviceWorker.includes('caches.open(CACHE_NAME)'));
});

void test('service worker refreshes cached navigations in the background', async () => {
  const serviceWorker = await readFile(
    join(projectRoot, 'public/sw.js'),
    'utf8',
  );

  ok(serviceWorker.includes('async function staleWhileRevalidate'));
  ok(serviceWorker.includes('event.waitUntil(refresh)'));
  ok(!serviceWorker.includes('networkFirstNavigation'));
});

void test('service worker opens the archive when a reminder is tapped', async () => {
  const serviceWorker = await readFile(
    join(projectRoot, 'public/sw.js'),
    'utf8',
  );

  ok(serviceWorker.includes("self.addEventListener('notificationclick'"));
  ok(serviceWorker.includes("matchAll({ type: 'window'"));
  ok(serviceWorker.includes('self.clients.openWindow(targetUrl)'));
});
