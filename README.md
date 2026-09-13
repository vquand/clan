# Clan Archive

A mobile-first, open-source family archive for publishing a member directory, relationship profiles, a family tree, and important clan dates. The interface defaults to Vietnamese and can be switched to English or French.

The repository contains only fictional sample records. Production data lives in Neon and is served by the Render API; the Vercel frontend never needs a database credential.

## Features

- searchable member directory with generation filters;
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

The public archive remains read-only, while `/admin/` provides a protected workspace for maintaining records. The backend reads `ADMIN_USERNAME` and `ADMIN_PASSWORD` from its private environment and issues short-lived HttpOnly session cookies after login. Environment variables prevent source-code disclosure; they are not a substitute for publishing only information that the affected family members have agreed to share. Do not include identity numbers, private addresses, phone numbers, medical information, or other sensitive records.

The admin session protects changes to the database; it does not make records private once they are returned by `GET /api/clan`. If the records must remain confidential, the public read endpoint also needs authentication and authorization.

## Quick start

Node.js 22 is required.

```bash
npm ci
npm run dev
```

Open the local address printed by Vinext. With no `NEXT_PUBLIC_API_URL`, the frontend uses the fictional records in [`data/members.ts`](data/members.ts) and [`data/events.ts`](data/events.ts).

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

The active database migration path is a single squashed baseline at
[`db/migrations/001_baseline.sql`](db/migrations/001_baseline.sql). The original
15 migration files are preserved in
[`db/migrations-archive/`](db/migrations-archive/) as an immutable rollback and
audit backup. On the first deployment after the squash, the migration runner
recognizes the already-complete production schema and records the baseline
without replaying the historical SQL. Future schema changes should use new
numbered migration files under `db/migrations/`.

### Dataset shape

The root JSON object contains `members` and `events` arrays. The complete fictional example is in [`examples/clan-data.example.json`](examples/clan-data.example.json).

Required member fields (birth year and life status are optional when unknown):

```json
{
  "id": "unique-id",
  "fullName": "Full name",
  "gender": "male | female | other",
  "generation": 1,
  "branch": "Branch name",
  "birthYear": 1950,
  "status": "living | deceased",
  "parentIds": [],
  "spouseIds": []
}
```

Optional member fields include `familiarName`, `birthDate`, `deathYear`, `deathDate`, `ageAtDeath`, `ageAtDeathQualifier`, `deathAnniversaryLunar`, `hometown`, `residence`, and `biography`. Use `ageAtDeathQualifier` with `exact`, `approximately`, or `under` when the recorded age is qualified. Spouse references must be declared in both member records.

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

## Deployment

### Neon

Create a Neon project and copy its pooled Postgres connection string. The Render service reads it from the `DATABASE_URL` environment variable. Do not expose that value to the browser or commit it.

### Render backend

[`render.yaml`](render.yaml) defines the Node web service. Create a Render Blueprint from this repository, then set:

- `DATABASE_URL`: the Neon connection string;
- `CORS_ORIGINS`: the exact Vercel production URL, plus any preview URLs you need.

Render runs `db:migrate` before starting the API and exposes:

- `GET /health` for the Render health check;
- `GET /api/clan` for the Vercel frontend.

The protected admin API uses:

- `POST /api/admin/login`, `GET /api/admin/session`, and `POST /api/admin/logout` for the admin session;
- `GET /api/admin/data` to load the editable dataset;
- `POST|PATCH|DELETE /api/admin/members` and `/api/admin/members/:id` for member CRUD, parent/spouse links, and avatar fields;
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

Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and preferably a long random `ADMIN_SESSION_SECRET` only on the Render service. Never add them to Vercel or commit them to the repository. Open `/admin/` on the deployed Vercel site to use the workspace.

## Development commands

```bash
npm test                # unit tests
npm run test:browser    # desktop and mobile browser tests
npm run validate:data   # validate sample, CLAN_DATA_JSON, or CLAN_DATA_FILE records
npm run db:migrate      # apply the Neon schema (DATABASE_URL required)
npm run db:seed         # seed Neon (DATABASE_URL plus optional CLAN_DATA_FILE)
npm run start:api       # start the Render-compatible API locally
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
