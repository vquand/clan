# Clan Archive

A mobile-first, open-source family archive for publishing a member directory, relationship profiles, a family tree, and important clan dates. The interface defaults to Vietnamese and can be switched to English or French.

The repository contains only fictional sample records. Production data lives in Neon and is served by the Render API; the Vercel frontend never needs a database credential.

## Features

- searchable member directory with sibling filtering for administrators;
- member profiles with names, birth details, residence, relationships, life status, and lunar death anniversaries;
- recursive family-tree view with horizontal navigation on small screens;
- solar and manually verified lunar event calendar;
- Vietnamese (`vi`) by default, plus English (`en`) and French (`fr`);
- three reading sizes, persisted in the visitor's local storage;
- mobile-first layout with touch-friendly controls;
- static frontend output deployed on Vercel;
- a Render API backed by Neon Postgres, with a protected admin workspace for managing the archive;
- validation for IDs, relationships, cycles, dates, and private seed data.

## Privacy model

This project separates **public application code** from **deployment-specific clan data**:

```text
Public GitHub repository ── fictional samples + application code
             │
             ├── Vercel frontend ── NEXT_PUBLIC_API_URL only
             │                            │
             └── Render API ─────────────┘
                         │
                    Neon Postgres
```

The browser-visible `NEXT_PUBLIC_API_URL` contains no secret. `DATABASE_URL` stays on Render, and `CLAN_DATA_JSON`/`CLAN_DATA_FILE` are used only when seeding Neon. Do not put either of those values in Vercel.

The archive is private by default. The backend reads one shared `GUEST_PASSWORD` of at least eight characters from its private environment. Family members enter only that password—there are no guest usernames or accounts—and receive a 30-day HttpOnly session cookie on the device. Administrators still use the separate credentials in `ADMIN_USERNAME` and `ADMIN_PASSWORD` for editing.

`GET /api/clan` accepts either a guest session or an admin session and fails closed when `GUEST_PASSWORD` is missing. Keep all passwords on the API service, never in Vercel's frontend environment. A shared password is appropriate for one trusted family group, but it should be changed whenever access must be withdrawn from someone who knows it.

## Quick start

Node.js 22 is required.

```bash
npm ci
npm run dev
```

Open the local address printed by Vinext. With no `NEXT_PUBLIC_API_URL`, the frontend uses the fictional records in [`data/members.ts`](data/members.ts) and [`data/events.ts`](data/events.ts).

### Local demo API without Neon

For a demo that uses the same API path as production, copy [`.env.example`](.env.example) to `.env` and leave `DATABASE_URL` empty. Start the API and frontend in separate terminals:

```bash
cp .env.example .env
npm run start:api   # terminal 1, serves data/db.json
npm run dev         # terminal 2
```

When `DATABASE_URL` is empty, the API reads the fictional records from [`data/db.json`](data/db.json) for `GET /api/clan` and authenticated `GET /api/admin/data`. This fallback is read-only: admin create, edit, reorder, and delete requests require a configured database URL. Set `GUEST_PASSWORD` in `.env` to open the demo archive, and set `ADMIN_USERNAME` and `ADMIN_PASSWORD` if you also want the admin view.

To run the API locally, set `DATABASE_URL` to a Neon connection string, run the migration and seed it, then start the service:

```bash
DATABASE_URL="postgresql://..." npm run db:migrate
DATABASE_URL="postgresql://..." CLAN_DATA_FILE="/private/path/clan-data.json" npm run validate:data
DATABASE_URL="postgresql://..." CLAN_DATA_FILE="/private/path/clan-data.json" npm run db:seed
DATABASE_URL="postgresql://..." CORS_ORIGINS="http://localhost:3000" npm run start:api
```

Set `NEXT_PUBLIC_API_URL=http://localhost:10000` in the frontend environment when you want local pages to load the Neon-backed API.

## Use clan data without committing it

1. Copy [`examples/clan-data.example.json`](examples/clan-data.example.json) somewhere outside the public repository.
2. Replace the fictional records while keeping the documented shape.
3. Validate the private file with `CLAN_DATA_FILE=/private/path/clan-data.json npm run validate:data`.
4. Seed Neon with `DATABASE_URL="postgresql://..." CLAN_DATA_FILE=/private/path/clan-data.json npm run db:seed`.
5. Never commit the private JSON file or a `.env.local` file; both are ignored by Git.
6. Validate and build before publishing:

```bash
npm run validate:data
npm test
npm run lint
npm run build
```

The database uses relational `members` and `events` tables with generated UUID primary keys. Parent, spouse, event-member, and yearly solar-date associations live in dedicated relationship tables. Generation numbers are derived from those relationships rather than stored, and branch labels are optional display metadata rather than identifiers. Re-running `db:seed` replaces the relational dataset in one transaction. The production database retains the original JSON tables under `*_legacy_json` names as a migration backup; they are not read by the API or created by the new baseline.

The active database migration path starts with a single squashed baseline at
[`db/migrations/001_baseline.sql`](db/migrations/001_baseline.sql). The original
15 migration files are preserved in
[`db/migrations-archive/`](db/migrations-archive/) as an immutable rollback and
audit backup. On the first deployment after the squash, the migration runner
recognizes the already-complete production schema and records the baseline
without replaying the historical SQL. Future schema changes should use new
numbered migration files under `db/migrations/`.

Migration `004_add_default_lunar_events.sql` adds the seven standard Vietnamese
lunar observances to an existing production database when their lunar calendar
slots are not already occupied. The migration is safe to run once through
`db:migrate`; the seed command also merges the same defaults into future full
re-seeds without replacing an existing event in one of those slots.

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

For a lunar event, manually verify and provide its solar date for each supported year:

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

## Deployment

### Neon

Create a Neon project and copy its pooled Postgres connection string. The Render service reads it from the `DATABASE_URL` environment variable. Do not expose that value to the browser or commit it.

### Render backend

[`render.yaml`](render.yaml) defines the Node web service. Create a Render Blueprint from this repository, then set:

- `DATABASE_URL`: the Neon connection string;
- `CORS_ORIGINS`: the exact Vercel production URL, plus any preview URLs you need;
- `GUEST_PASSWORD`: the shared password family members use to view the archive.

Render runs `db:migrate` before starting the API and exposes:

- `GET /health` for the Render health check;
- `POST /api/guest/login` for password-only guest access;
- authenticated `GET /api/clan` for the Vercel frontend.

That startup migration activates the standard lunar observances in production;
their solar dates are calculated for each displayed year by the calendar.

The protected admin API uses:

- `POST /api/admin/login`, `GET /api/admin/session`, and `POST /api/admin/logout` for the admin session;
- `GET /api/admin/data` to load the editable dataset;
- `POST|PATCH|DELETE /api/admin/members` and `/api/admin/members/:id` for member CRUD, parent/spouse links, sibling order, and avatar fields;
- `POST /api/admin/siblings/reorder` for saving a complete oldest-to-youngest sibling order;
- `POST|PATCH|DELETE /api/admin/events` and `/api/admin/events/:id` for event CRUD and optional 0-to-many member links.

The admin member avatar picker offers the four system avatar styles plus one custom image. Uploaded custom images are center-cropped to 64×64, compressed to a small JPEG/WebP data URL, limited to 24 KB, and validated again by the API and database before saving to Neon.

Each member stores an internal `clan_relation` value: `lineage` for names
containing `Đỗ` and `marriage` for people who joined from outside the clan.
The value supports the family-tree data model and is not shown as a relationship
label in the interface.

Seed the database once from a machine that can access the private dataset:

```bash
DATABASE_URL="postgresql://..." CLAN_DATA_FILE="/private/path/clan-data.json" npm run db:seed
```

### Vercel frontend

[`vercel.mjs`](vercel.mjs) selects the `Other` framework preset, runs `npm ci` and `npm run build`, publishes `dist/client`, and proxies `/api/*` to Render. The browser therefore uses a same-origin `/api/clan` request and does not depend on CORS for normal frontend traffic. Connect the repository to Vercel with `main` as the Production Branch. Every push to `main` creates a production deployment.

Set `API_URL` in Vercel's **Production** environment to the Render service origin, for example `https://clan-api.onrender.com`. Set it in **Preview** as well if previews should use the backend. `NEXT_PUBLIC_API_URL` remains accepted while migrating existing projects, but the URL no longer needs to be exposed to browser code. Redeploy after changing environment variables; Vercel applies them to new deployments.

Set `CLAN_DISPLAY_NAME` in the Vercel frontend build environment to the family name, for example `Đỗ Văn`. The public browser tab, archive header, and loading screen then use `Họ Đỗ Văn`. This value must be configured on the frontend build; a backend-only `.env` value cannot change a static Vercel page.

Set `GUEST_PASSWORD`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and preferably a long random `ADMIN_SESSION_SECRET` only on the Render service. Never add them to Vercel or commit them to the repository. Visitors use the shared guest password on the opening screen; administrators then sign in from the archive footer to use the management controls.

## Development commands

```bash
npm test                # unit tests
npm run test:browser    # desktop and mobile browser tests
npm run validate:data   # validate sample, CLAN_DATA_JSON, or CLAN_DATA_FILE records
npm run db:migrate      # apply the Neon schema (DATABASE_URL required)
npm run db:seed         # seed Neon (DATABASE_URL plus optional CLAN_DATA_FILE)
npm run start:api       # start the API locally; empty DATABASE_URL uses data/db.json
npm run lint            # source linting
npx tsc --noEmit        # type checking
npm run format -- --check
npm run build           # static production export
```

## Contributing

Issues and pull requests are welcome. Please keep contributions free of real personal data.

1. Fork the repository and create a focused branch.
2. Add tests for new behavior.
3. Run the validation commands above.
4. Open a pull request describing the user-facing change and any privacy implications.

When adding an interface message, provide Vietnamese, English, and French translations. Vietnamese remains the fallback and default locale.

## License

[MIT](LICENSE)
