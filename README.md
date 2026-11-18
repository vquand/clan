# Clan Archive

A mobile-first family archive with member profiles, a family tree, a solar/lunar calendar, Vietnamese, English, and French interfaces, and a protected admin workspace.

Production runs entirely on Cloudflare: Workers Static Assets serves the static Vinext frontend, the same Worker serves `/api/*`, and D1 stores the relational archive. Passwords are Worker secrets; the browser receives HttpOnly session cookies. Private data never belongs in the repository or static build.

See [the Cloudflare migration and setup guide](docs/cloudflare-migration.md) for account resources, the Neon transfer, deployment, verification, and rollback.

## Local development

Use Node.js 22.12 or newer within the 22.x release line.

```bash
npm ci
cp .env.example .env
cp .dev.vars.example .dev.vars
npm run build
npm run db:migrate
mkdir -p work
npm run db:seed -- work/demo.sql
npx wrangler --config wrangler.worker.jsonc d1 execute DB --local --file work/demo.sql
npm run dev:worker
```

Open `http://localhost:8787` for the built frontend and real local D1 backend. Local credentials are in `.dev.vars`. Wrangler keeps the local D1 database separate from the production binding in `wrangler.worker.jsonc`. Local commands never write to remote D1 unless `--remote` is explicit.

For frontend hot reload, also run `npm run dev` and open its printed address. Vite proxies `/api` to the local Worker on port 8787. Rebuild before checking changes on the Worker address. `CLAN_DISPLAY_NAME` in `.env` controls the public family name at build time.

For a standalone, read-only sample frontend, run `CLAN_DEMO=true npm run dev`. `npm run start:api` retains the old Node demo API for compatibility tests; production uses `server/worker.mjs` and D1.

## Privacy and data

The repository contains fictional samples only. Guests enter `GUEST_PASSWORD` (at least eight characters) and receive a 30-day HttpOnly cookie. Admins use `ADMIN_USERNAME` and `ADMIN_PASSWORD`, with an eight-hour signed session. Configure a separate random `ADMIN_SESSION_SECRET` in production. Missing guest configuration fails closed.

All browser API calls stay on the same origin. API responses use `Cache-Control: no-store`; the service worker excludes `/api/*`. The existing offline cache stores archive data on a device after a successful authorized load. The [PWA specification](docs/specs/pwa.md) describes that behavior.

New data imports can use `CLAN_DATA_FILE=/private/path/clan.json npm run db:seed -- /private/path/seed.sql`. Import this SQL into a new, empty D1 database. It adds the default lunar observances and generates UUIDs for sample/import keys. It never deletes existing data. Use the raw Neon snapshot path in the migration guide to preserve existing production UUIDs, timestamps, flags, and all other columns.

D1 migrations live in `db/d1-migrations/`. The PostgreSQL migration history and legacy migration/seed scripts remain for source-system audit and rollback. They are not deployed or run against D1.

### Dataset shape

The root JSON object contains `members` and `events` arrays. The complete fictional example is in [`examples/clan-data.example.json`](examples/clan-data.example.json).

Required member fields (birth year and life status are optional when not recorded):

```json
{
  "id": "unique-id",
  "fullName": "Full name",
  "gender": "male | female | other",
  "generation": 1,
  "branch": "Branch name",
  "birthYear": 1950,
  "status": "living | deceased | unknown",
  "parentIds": [],
  "spouseIds": []
}
```

Omit `status` when the life status has not been entered. Use `unknown` only
when an administrator explicitly records that the family has no current
contact or specific information.

Optional member fields include `familiarName`, `birthDate`, `siblingOrder`, `deathYear`, `deathDate`, `ageAtDeath`, `ageAtDeathQualifier`, `deathAnniversaryLunar`, `hometown`, `residence`, and `biography`. `siblingOrder` is an oldest-to-youngest rank used when a sibling group has incomplete birth records; the admin reorder control writes the complete group. Updating one member's rank automatically shifts the affected siblings and keeps the group numbered consecutively. Without a complete manual order, the tree uses exact birth date, then birth year. Use `ageAtDeathQualifier` with `exact`, `approximately`, or `under` when the recorded age is qualified. Spouse references must be declared in both member records.

Saving a member's `deathAnniversaryLunar` automatically adds an annual lunar
death anniversary to the calendar and event reminders. No separate event record
or yearly setup is needed. Editing or clearing the member's anniversary updates
the automatic event; explicitly living members are excluded. Admins edit these
dates through the member profile. An existing annual lunar death-anniversary
event linked to the same member on the same lunar date is used instead, retaining
its location and any checked solar dates. Other events on that date still appear.

Lunar dates use the Vietnamese calendar (UTC+7) and the existing preference for
the leap-month occurrence when a month repeats. A day-30 death anniversary falls
on day 29 when that lunar month has only 29 days. The calendar and reminders
include late lunar months in the correct Gregorian year, including tháng Chạp
anniversaries in January or February.

Required event fields:

```json
{
  "id": "unique-event-id",
  "title": "Event title",
  "type": "death-anniversary | clan-ceremony | gathering",
  "calendar": "solar | lunar",
  "day": 18,
  "month": 4,
  "recurrence": "annual | once",
  "relatedMemberIds": [],
  "location": "Location"
}
```

Lunar event solar dates are calculated automatically. Optional `solarDates`
override the calculation for a lunar year when the family has checked a date:

```json
{
  "solarDates": {
    "2026": "2026-04-28",
    "2027": "2027-04-18"
  }
}
```

## Internationalization

Vietnamese is the deterministic default on every new page load. Visitors can switch the application interface to English or French from the header. The document language and locale-aware dates update with the selection.

Interface translations live in [`lib/i18n.ts`](lib/i18n.ts). Names, biographies, locations, branch names, and event titles come from the clan dataset and are displayed as authored; translate those values in the dataset if desired.

## Accessibility and mobile support

The base CSS targets mobile screens first. Layouts expand at `581px` and `821px`, while the family tree remains horizontally navigable on narrow screens. Controls use native buttons and selects, visible focus states, accessible names, and touch targets of at least 44 CSS pixels.

Visitors can choose standard, large, or extra-large text. The setting changes the root type scale so rem-based text and controls grow together, and it is saved under `clan-reading-size` in local storage. No user account or server-side preference storage is involved.

### Install as an app

The production frontend is an installable PWA. It must be served over HTTPS
(localhost is also supported for testing). On iPhone or iPad, open the archive
in Safari, tap **Share**, choose **Add to Home Screen**, and enable **Open as
Web App** when that option is shown. On Android, open the archive in Chrome,
then choose **Install app** or **Add to Home screen** from the browser menu.

The installed app caches its static shell and branded icons for faster reopen.
Repeat navigations serve the cached frontend immediately while the latest page
is refreshed in the background, so deployments become available without making
the first screen wait for the network. The first visit still needs the network;
an offline visit uses the cached shell. Clan API requests, guest/admin
sessions, and all data mutations remain network-only and are never cached by
the service worker.

## Development commands

```bash
npm test                  # unit and SQLite-backed Worker integration tests
npm run test:browser      # required desktop and mobile Playwright tests
npm run validate:data     # validate sample or CLAN_DATA_FILE records
npm run db:migrate        # migrate local D1
npm run db:migrate:remote # migrate remote D1; requires Cloudflare login
npm run db:seed -- /private/path/new-seed.sql
npm run lint
npx tsc --noEmit
npm run build             # static production export
npm run deploy:check      # bundle Worker and validate bindings without deploying
npm run deploy            # build and deploy Worker + static assets
```

## Contributing

Keep contributions free of real personal data. Add tests for changed behavior, run the checks above, and provide Vietnamese, English, and French translations for interface messages.

## License

[MIT](LICENSE)
