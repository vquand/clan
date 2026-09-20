# Spec: Clan Archive Progressive Web App

## Objective

Make the Clan Archive installable as a standalone PWA from Safari on iOS and
Chrome/Edge on Android without changing the archive's data or authentication
model. The installed app should open the same responsive archive, retain the
existing visual identity, and provide a useful cached shell when the network is
temporarily unavailable.

### User stories

- As an iOS visitor, I can use Safari's Share menu to add the archive to my
  Home Screen and open it without browser chrome.
- As an Android visitor, I can install the archive from the browser's install
  prompt or menu and open it as a standalone app.
- As an installed visitor, I can reopen the app and see the cached application
  shell while live clan data continues to use the existing API behavior.

## Tech Stack

- React 19 and Vinext/Next-style app router
- Static frontend export served from `dist/client`
- Existing PNG brand assets under `public/`
- Browser Service Worker and Web App Manifest APIs; no new runtime dependency

## Commands

```bash
npm test
npm run lint
npm run build
npx playwright test tests/browser/pwa.spec.ts
```

## Project Structure

```text
app/layout.tsx                 -> manifest link and mobile/PWA metadata
components/pwa-register.tsx    -> client-side service-worker registration
public/manifest.webmanifest    -> install metadata and icon declarations
public/sw.js                   -> versioned app-shell cache and navigation fallback
public/icons/                  -> 192px, 512px, and maskable install icons
tests/browser/pwa.spec.ts      -> browser-visible manifest and registration checks
```

## Code Style

Keep the PWA layer small, additive, and defensive. Registration must be
browser-only and must not prevent the archive from rendering when service
workers are unavailable:

```tsx
'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
  }, []);

  return null;
}
```

Use the existing `CLAN_DISPLAY_NAME`-derived title for the document, with
stable generic manifest copy because the manifest is a static public asset.
Use explicit absolute-root URLs so the app works with the existing
`PAGES_BASE_PATH` deployment configuration only when the static host serves the
root manifest and service-worker paths.

## Testing Strategy

- Unit/static checks: validate manifest JSON and required icon declarations
  through the existing Node test runner.
- Browser test: confirm `/manifest.webmanifest` is linked, has installable
  display metadata, and the page registers `/sw.js` without console errors.
- Build verification: ensure static export includes the manifest, service
  worker, and icon files.
- Existing unit, lint, build, and archive browser tests must remain green.

The service worker uses cache-first behavior for same-origin static assets and a
stale-while-revalidate navigation strategy: an existing shell is returned
immediately while the latest HTML is refreshed in the background. The first
visit still waits for the network, and an offline visit falls back to the
cached shell. API requests and non-GET mutations remain network-only, so stale
or private clan data is not silently cached.

## Boundaries

- Always: keep the app functional when service workers are unsupported; use
  HTTPS in production; validate the built static output; preserve the existing
  API and authentication behavior.
- Ask first: changing the deployment host's HTTPS/base-path contract; adding
  push notifications, background sync, offline data editing, or new runtime
  dependencies.
- Never: cache guest/admin credentials, API responses, private clan records, or
  commit generated build output and secrets.

## Success Criteria

- `manifest.webmanifest` is linked from every page and declares a standalone
  app, portrait orientation, theme/background colors, and 192px/512px icons.
- Apple touch metadata and safe-area viewport behavior are present for iOS.
- A service worker registers at `/sw.js` and is included in the production
  static output.
- The service worker caches same-origin app-shell assets and does not intercept
  API requests or non-GET requests.
- Automated tests prove the manifest contract, service-worker registration, and
  production build output.
- `npm test`, `npm run lint`, `npm run build`, and the PWA browser spec pass.

## Open Questions

None for the installability baseline. Offline data browsing and push
notifications are intentionally outside this change.
