# Clan Archive

A mobile-first, open-source family archive for publishing a member directory, relationship profiles, a family tree, and important clan dates. The interface defaults to Vietnamese and can be switched to English or French.

The repository contains only fictional sample records. A personal deployment can inject its own dataset during the build without committing that information to the public source tree.

## Features

- searchable member directory with generation filters;
- member profiles with names, birth details, residence, relationships, life status, and lunar death anniversaries;
- recursive family-tree view with horizontal navigation on small screens;
- solar and manually verified lunar event calendar;
- Vietnamese (`vi`) by default, plus English (`en`) and French (`fr`);
- three reading sizes, persisted in the visitor's local storage;
- mobile-first layout with touch-friendly controls;
- static output suitable for Vercel and GitHub Pages;
- validation for IDs, relationships, cycles, dates, and private build data.

## Privacy model

This project separates **public application code** from **deployment-specific clan data**:

```text
Public GitHub repository ── fictional samples + application code
                                      │
Vercel build environment ── CLAN_DATA_JSON with your clan records
                                      │
Static production site ───── records visible to every site visitor
```

`CLAN_DATA_JSON` is read only while the static site is built. Its value is not committed to Git, and Vercel stores environment variables outside the repository.

However, this application intentionally has **no login system**. Any record rendered on the deployed site is delivered to the visitor's browser and must be treated as public. Environment variables prevent source-code disclosure; they are not access control. Publish only information that the affected family members have agreed to share. Do not include identity numbers, private addresses, phone numbers, medical information, or other sensitive records.

If the records must remain confidential, the project needs authentication and a server-side authorization layer; that is a different security model from this login-free static application.

## Quick start

Node.js 22 is required.

```bash
npm ci
npm run dev
```

Open the local address printed by Vinext. With no environment override, the application uses the fictional records in [`data/members.ts`](data/members.ts) and [`data/events.ts`](data/events.ts).

## Use clan data without committing it

1. Copy [`examples/clan-data.example.json`](examples/clan-data.example.json) somewhere outside the public repository.
2. Replace the fictional records while keeping the documented shape.
3. Minify the JSON and store it as `CLAN_DATA_JSON` in a local `.env.local` file or in Vercel's Environment Variables settings.
4. Never commit `.env.local`; it is ignored by Git.
5. Validate and build before publishing:

```bash
npm run validate:data
npm test
npm run lint
npm run build
```

For Vercel, add `CLAN_DATA_JSON` to the **Production** environment and redeploy. Environment-variable changes apply only to new deployments. The loader accepts up to 60 KB so the complete Vercel environment remains below its 64 KB deployment limit. For a larger archive, use a dedicated data service rather than expanding the environment variable.

For private version history, keep the real JSON file in a separate private repository. The first version can be copied into Vercel manually; a later private CI workflow can update the environment and trigger redeployment without exposing the records in this repository.

### Dataset shape

The root JSON object contains `members` and `events` arrays. The complete fictional example is in [`examples/clan-data.example.json`](examples/clan-data.example.json).

Required member fields:

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

Optional member fields include `familiarName`, `birthDate`, `deathDate`, `deathAnniversaryLunar`, `hometown`, `residence`, and `biography`. Spouse references must be declared in both member records.

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

### Vercel

[`vercel.json`](vercel.json) selects the `Other` framework preset, runs `npm ci` and `npm run build`, and publishes `dist/client`. Connect the repository to Vercel with `main` as the Production Branch. Every push to `main` creates a production deployment.

Set `CLAN_DATA_JSON` only in the environments where real records should appear. Preview deployments can omit it and safely use fictional samples.

### GitHub Pages

The workflow in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) validates, audits, builds, and publishes the fictional-data version from `main` to:

<https://vquand.github.io/clan/>

If the repository name changes, update `PAGES_BASE_PATH` in the workflow.

## Development commands

```bash
npm test                # unit tests
npm run test:browser    # desktop and mobile browser tests
npm run validate:data   # validate sample or CLAN_DATA_JSON records
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
