# Cloudflare setup and migration

The target is one Cloudflare Worker (`dovan`) plus one D1 database (`clan-archive`, bound as `DB`). Workers Static Assets hosts the existing static Vinext frontend. The Worker handles authentication and every `/api/*` request on the same origin. D1 replaces Neon PostgreSQL.

No Pages project, Render service, Hyperdrive, KV namespace, or R2 bucket is required. Portraits already stored as data URLs remain in D1. Hosted portrait URLs remain URLs: move any files served by an old provider into `public/` or another Cloudflare asset store before retiring that provider.

The configuration is explicitly named `wrangler.worker.jsonc` so Vinext retains its static export build instead of selecting its separate SSR deployment integration. All deployment scripts select this configuration explicitly.

Before merging this branch, disable automatic deployments on the old Vercel, Render, and GitHub Pages projects. Keep their current deployments serving traffic until the Cloudflare cutover. The new branch removes their deployment configuration and changes the production API to the Cloudflare origin.

## 1. Create the Cloudflare resources

1. Create or sign into your Cloudflare account. In **Workers & Pages**, choose a `workers.dev` subdomain if your account does not have one yet. A custom domain is optional.
2. Install project dependencies and authenticate from your own terminal:

   ```bash
   npm ci
   npx wrangler login
   npx wrangler whoami
   npx wrangler d1 create clan-archive --location apac
   ```

3. Copy the returned database UUID into `d1_databases[0].database_id` in [`wrangler.worker.jsonc`](../wrangler.worker.jsonc). Keep `binding` as `DB`. If you choose a different database name, update `database_name` too. With multiple accounts, set `CLOUDFLARE_ACCOUNT_ID` in your terminal or deployment environment.
4. `npm run deploy` creates or updates the Worker; a separate placeholder Worker is unnecessary. Use a separate Worker and D1 database for staging. Never attach untrusted branch previews to production D1; preview URLs are disabled here.

The APAC location is a placement hint for the family's region, not a data residency guarantee. Review current [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) against your expected usage.

## 2. Rehearse locally before touching production

```bash
cp .env.example .env
cp .dev.vars.example .dev.vars
npm run build
npm run db:migrate
mkdir -p work
npm run db:seed -- work/demo.sql
npx wrangler --config wrangler.worker.jsonc d1 execute DB --local --file work/demo.sql
npm run dev:worker
```

Open `http://localhost:8787`. Unlock with the local password in `.dev.vars`, then sign into admin from the archive footer. Verify member edits, sibling ordering, clan-head changes, locations, lunar events, and uploaded portraits. The local database stays under ignored `.wrangler/`; it is separate from remote D1. Seed output paths must be new files.

To rehearse the actual transfer, use the snapshot conversion below with `--local`, then run `npm run db:verify -- /private/path/neon.json --local`. Use a fresh local database instead of mixing the fictional seed and production records. Keep private exports outside the repository.

## 3. Export Neon without changing source data

1. Back up Neon first, including any legacy JSON tables you want to retain. The transfer script copies the seven active relational tables only. A full PostgreSQL backup can be made with your usual Neon backup tools or `pg_dump`.
2. Stop admin writes on the old deployment before the final export. For example, save the existing admin settings privately, then temporarily remove `ADMIN_USERNAME` from Render and redeploy it. Guest reads can continue. Do not edit either database during transfer and verification.
3. Put the Neon connection URL in the ignored local `.env` as `DATABASE_URL`. Never paste it into public build settings, source files, or issue comments.
4. Export a consistent, read-only snapshot and convert it to D1 SQL:

   ```bash
   npm run db:export:neon -- /private/path/neon.json
   npm run db:convert -- /private/path/neon.json /private/path/d1-import.sql
   ```

The export reads all seven tables in one repeatable-read transaction. It preserves existing UUIDs, relationships, timestamps, life status, sibling order, avatar data, clan-head flags, locations, and event solar-date overrides. Output files use mode `0600` and refuse to overwrite existing files. This path does not regenerate UUIDs or add events.

Do not use `db:seed` to transfer production Neon data. The seed format is a separate import format that generates new UUIDs.

## 4. Import into new, empty remote D1

```bash
npm run db:migrate:remote
npx wrangler --config wrangler.worker.jsonc d1 execute DB --remote --command "SELECT (SELECT count(*) FROM members) AS members, (SELECT count(*) FROM events) AS events, (SELECT count(*) FROM clan_locations) AS locations"
npx wrangler --config wrangler.worker.jsonc d1 execute DB --remote --file /private/path/d1-import.sql
npm run db:verify -- /private/path/neon.json --remote
npx wrangler --config wrangler.worker.jsonc d1 execute DB --remote --command "PRAGMA foreign_key_check"
```

Check that the three counts are zero before importing. The verifier compares every exported column and row in all seven tables, not only counts. Foreign-key checking must return no violations. Nothing deletes existing records. Replaying the same SQL skips existing primary keys, allowing an interrupted import to resume. It does not update conflicting records: verification will fail if the target differs. Stop and investigate a mismatch; never cut over on counts alone.

Large datasets may exceed D1 import or query limits. This archive uses small relational rows and portraits capped at 24 KB; check the actual snapshot size before import. The verifier currently reads each table in one request, so split verification by primary key if the archive grows beyond Wrangler's result limits.

## 5. Configure secrets and deploy

Set `CLAN_DISPLAY_NAME` in `.env` before building. This is public display text embedded in the static frontend. Leave `CLAN_DEMO=false`; production always reads the API by default. Remove obsolete `API_URL`, `NEXT_PUBLIC_API_URL`, and `CORS_ORIGINS` deployment settings.

Set four Worker secrets interactively:

```bash
npx wrangler secret put GUEST_PASSWORD --config wrangler.worker.jsonc
npx wrangler secret put ADMIN_USERNAME --config wrangler.worker.jsonc
npx wrangler secret put ADMIN_PASSWORD --config wrangler.worker.jsonc
npx wrangler secret put ADMIN_SESSION_SECRET --config wrangler.worker.jsonc
npm run deploy
```

Wrangler can offer to create the Worker when adding the first secret. Accept that prompt; the later deploy uploads the application and assets. Use a long random session secret. Keep the existing passwords if you want family members to continue using them. A new hostname still requires a new login because cookies and browser storage belong to their origin.

The deployed Worker needs no `DATABASE_URL`. `DB` is a private D1 binding. `.dev.vars` contains local development values only; never commit it. API responses use `no-store`, mutations enforce the request origin, and the service worker never caches API responses. D1 stores login failure counters by client IP and login scope with a fifteen-minute expiry.

Validate the new `https://dovan.<your-subdomain>.workers.dev` URL before routing users to it. Check `/health`, guest login, unauthorized API rejection, admin login/logout, member CRUD, relationships, sibling order, current/previous head flags, locations, event CRUD, and lunar dates. Check the PWA on a phone. Keep old admin writes disabled during this validation; use disposable test records and remove them afterward.

## 6. Choose one automatic deployment path

**Cloudflare Workers Builds:** connect the repository to the existing Worker in its Cloudflare dashboard. Use the repository root, build command `npm run build`, and deploy command `npm run db:migrate:remote && npx wrangler --config wrangler.worker.jsonc deploy`. Set build variables `NODE_VERSION=22`, `CLAN_DISPLAY_NAME`, and `CLAN_DEMO=false`. Keep app passwords in Worker secrets. Select the production branch only. Disable automatic non-production deployments unless you configure separate databases and secrets. The build token needs permission to deploy Workers and apply D1 migrations.

**GitHub Actions:** the included [workflow](../.github/workflows/deploy-cloudflare.yml) supports manual deployment. Create GitHub environment `production`. Add secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; use a token restricted to the intended Cloudflare account with Workers Scripts Edit and D1 Edit permissions. Add repository variable `CLAN_DISPLAY_NAME`. After successful cutover, set repository variable `CLOUDFLARE_DEPLOY_ENABLED=true` to enable deployments on pushes to `main`. Keep this unset while preparing the migration. Configure any extra zone permissions required for a custom domain. The workflow runs tests and builds before applying D1 migrations and deploying.

Use one automatic path to avoid competing deployments. Do not put application passwords or the Neon connection URL in frontend build variables. Keep Cloudflare authentication tokens out of the repository.

CI and GitHub deployment audit all dependencies with `npm audit --audit-level=high`. React 19.2.9 and compatible framework/tool updates resolve the critical and patched high-severity findings. The private [Picomatch compatibility package](../compat/picomatch/README.md) supplies a tested parser safeguard for the remaining matcher issue, which has no patched upstream npm release. The audit gate stays enabled without advisory exceptions. Eight moderate transitive findings remain in the image-generation and component-generator tools; they do not fail the existing high-severity gate.

Vinext's static prerender bundle externalizes `ipaddr.js`, so this existing framework dependency is pinned at the project root for reliable clean builds.

## 7. Cut over and retain rollback

1. Optionally add your domain under the Worker's **Settings → Domains & Routes → Add → Custom Domain**. The zone must be active in Cloudflare. Review the DNS change before replacing a hostname currently used by Vercel. Using the new `workers.dev` URL first avoids changing existing DNS during validation.
2. Compare the production dataset again before opening admin writes to the family. Make the Cloudflare URL the shared entry point, or switch the custom domain to the Worker.
3. Keep Vercel, Render, Neon, the full Neon backup, and the final snapshot during the observation period. Disable their automatic deployments so this branch cannot replace the old stack's configuration. Once Cloudflare accepts writes, freeze the old system permanently until retirement.
4. If rollback is necessary **before Cloudflare receives new data writes**, route users back to the old frontend/API and restore its admin configuration. The old stack and Neon remain unchanged by the transfer scripts.
5. If Cloudflare has accepted new writes, first freeze Cloudflare admin writes and export D1 (`npx wrangler --config wrangler.worker.jsonc d1 export DB --remote --output /private/path/d1-backup.sql`). Reconcile those changes into Neon before reopening the old system. A DNS rollback alone would lose access to the newer changes; there is no automatic reverse importer.
6. Retire the old services only after you approve the production behavior and backups. Deleting Vercel/Render/Neon resources is a separate action; this migration does not delete them.

Reference: [Workers Static Assets routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [D1 imports and exports](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), and [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
