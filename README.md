# ফি দেই, কিন্তু চাকরি নাই

An anonymous, Bangladesh-only crowdsourced database of job application fees. No applicant accounts, names, email addresses, or phone numbers. This is not a job board. Production begins with zero reports.

## Architecture

Next.js App Router, strict TypeScript, React, Tailwind CSS 4, PostgreSQL (Supabase-compatible), and Cloudflare Turnstile. Business logic uses parameterized PostgreSQL queries, independent of hosting. Server-only modules live in `lib/db`, `lib/security.ts`, and `lib/admin.ts`. Open Graph uses a checked-in browser-rendered PNG to preserve Bangla shaping; regenerate with `node scripts/social-card.mjs`. Bangla uses self-hosted Noto Sans Bengali under the included SIL Open Font License.

Normal validated reports are approved immediately. Amounts above `NORMAL_FEE_MAX` and repeats from the same ephemeral anonymous source within two minutes are flagged, not included in public aggregates. Zero-fee reports are supported per the specification's 0–10,000 range. Values must be integer BDT; values beyond PostgreSQL integer capacity are rejected. The median is calculated in PostgreSQL using `percentile_cont`, not from a limited recent-report list. Sample size is displayed. Slugs include a stable hash to avoid Unicode/punctuation collisions; original organization names remain on reports after merges.

## Local setup

Requires Node.js 24 and PostgreSQL 17+ (or Supabase). The repository includes a lockfile.

```sh
npm ci
cp .env.example .env.local
docker compose up -d db
node --env-file=.env.local --import tsx scripts/migrate.ts
npm run dev
```

Next.js automatically reads `.env.local`; migration/seed scripts require the shown `--env-file`. For local reporting set `DEV_BYPASS_TURNSTILE=true` and generate `ANTI_ABUSE_SECRET`. This bypass is disabled in production. The application renders truthful empty states without a database, and submission returns 503. Database failures show errors rather than presenting a failed read as zero real reports.

To generate random secrets: `openssl rand -hex 32`. To create an admin password hash: `npm run admin:hash` (14+ character password). Never commit `.env.local` or secrets.

## Environment variables

| Variable                         | Purpose                                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | Server-only PostgreSQL URL; use the Supabase transaction pooler for serverless hosting. Use TLS for remote connections. |
| `SITE_URL`                       | Full canonical site origin, no trailing slash. Used for metadata, sitemap and origin checks.                            |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public widget key, present at build time.                                                                               |
| `TURNSTILE_SECRET_KEY`           | Server-only CAPTCHA verification key.                                                                                   |
| `TURNSTILE_HOSTNAME`             | Expected hostname returned by Turnstile (no scheme).                                                                    |
| `ANTI_ABUSE_SECRET`              | At least 32 random characters for daily rotating HMAC source hashes.                                                    |
| `ADMIN_SESSION_SECRET`           | Independent 32+ random characters for eight-hour signed admin sessions.                                                 |
| `ADMIN_PASSWORD_HASH`            | Salted scrypt hash from the helper.                                                                                     |
| `NORMAL_FEE_MAX`                 | Default 10000; larger integer BDT amounts enter moderation.                                                             |
| `LEADERBOARD_MIN_REPORTS`        | Default 5 approved reports for median rankings.                                                                         |
| `DEV_BYPASS_TURNSTILE`           | Local-only bypass, never honored in production.                                                                         |
| `TEST_DATABASE_URL`              | Separate, empty disposable PostgreSQL database for integration tests.                                                   |

## Database

`migrations/001_initial.sql` creates organizations, fee reports, expiring abuse buckets, duplicate patterns and moderation audit. Migrations run transactionally and hold an advisory lock; applied names are recorded. RLS is enabled with no anonymous policies. Connect from the server with the table-owner role; never expose this URL to the browser. Application SQL is parameterized. RLS is a defense against accidental Supabase REST exposure, not the server authorization mechanism.

A development-only seed helper requires `ALLOW_DEV_SEED=true`, explicitly labels demo organizations and roles, and refuses `NODE_ENV=production`. Do not point it at a production database. Do not promote a seeded development database into production.

```sh
ALLOW_DEV_SEED=true node --env-file=.env.local --import tsx scripts/seed.ts
```

## Commands and testing

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm run test:local-db` provisions temporary embedded PostgreSQL without Docker and runs all unit/integration tests. `npx playwright install chromium` then `npm run test:browser` runs the anonymous submission, moderation, merge, six responsive sizes and axe accessibility checks against a separate temporary database. Set `CHROMIUM_PATH` to reuse a system browser if available. Browser fixtures use local-only CAPTCHA bypass; real Turnstile still requires deployed verification.

Unit tests cover normalization, fee validation, malformed Unicode/content, statistics, medians, unapproved exclusion, session/password verification and CSRF protection. Integration tests use a real disposable PostgreSQL database, require it to be empty, refuse the normal `DATABASE_URL`, and drop their created tables afterwards. Never use a real data database for tests. GitHub Actions provisions PostgreSQL and runs integration tests automatically.

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fee_test npm test
```

Manual acceptance checklist: valid anonymous report; missing organization/fee; negative/fractional/huge fee; Bangla and English names; script/emoji-only input; rapid repeats; case-insensitive organization/role search; detail pages; outlier approval/rejection; rename/merge; login/logout; keyboard errors; 320/375/390/430px, tablet, desktop; CAPTCHA expiry; database outage. Real Turnstile and a trusted hosting IP header must be tested on the production hostname.

## Moderation

Visit `/admin`, log in using the configured password, and review pending/flagged reports. Approve or reject. Correct obvious spelling with rename; if the normalized name already exists use merge. Merge moves all reports to the canonical organization within a transaction while preserving original submitted names. Admin cannot alter fee values. Changes are audited. Session cookies are HttpOnly, SameSite Strict, and Secure in production. Admin APIs verify both signed session and origin. Login attempts are rate limited.

## Privacy and security

The application stores no raw IP and no permanent contributor identifier. Daily-keyed HMAC values exist only in short-lived abuse tables, without a foreign key to reports. Rate limits are shared across server instances through atomic PostgreSQL upserts (five reports per ten minutes; five login attempts per fifteen minutes). Expired rows are deleted on activity; schedule `scripts/cleanup.sql` every 10 minutes using Supabase pg_cron or a database scheduler so retention stays bounded even when inactive.

**Trusted source header:** production reads `x-real-ip`. The recommended Vercel deployment overwrites it at the edge. Other hosts must strip client-provided forwarding headers and inject the real source address as `x-real-ip`. The app refuses writes without it. Never deploy behind an origin that clients can reach directly and spoof this header. Do not substitute an arbitrary client-controlled `x-forwarded-for` chain. Local development uses that header from Next.js.

Turnstile checks token validity, configured hostname and `fee-report` action; failure blocks writes. No raw IP is sent by this application to siteverify. Hosting/Turnstile may process technical information under their own policies. There is no analytics in V1. Error logs contain error types, not form payloads. Set hosting log retention appropriately. The privacy page describes actual processing and expiry/cleanup behavior.

Input is length bounded and validated server-side; control/bidi abuse, unpaired surrogates and HTML-like markup are rejected. React escapes displayed strings. No `dangerouslySetInnerHTML` is used. API origin checks defend cookie mutations; all admin operations require signed sessions. Security headers limit frames/resources. No public report IDs are returned.

## Deployment: initial free-tier route

Recommended portable route: **GitHub → Vercel Hobby → Supabase free PostgreSQL + free Turnstile**, with the provider subdomain. This avoids adapting Next.js to Workers and preserves the requested Next.js stack. Check current provider limits/terms (including Vercel Hobby's personal/noncommercial restriction); free quotas are not guaranteed forever. No domain purchase is required.

1. Create a GitHub repository and push `main`. CI checks each push/PR. Keep the remote private or choose an open-source license before making it public.
2. Create a separate, empty production Supabase project. Use its PostgreSQL owner/pooler connection with TLS. Never load development seeds.
3. Run the migration against production using a secure local environment, then clear credentials from temporary files.
4. Import the repository in Vercel (framework auto-detected as Next.js). Deploy with database/admin/anti-abuse variables. The public site key must be available during the build.
5. Register the assigned hostname in Cloudflare Turnstile; configure both keys, hostname and `SITE_URL`, then rebuild. Normal submit must fail until all are ready.
6. Confirm Vercel supplies a trusted, overwritten `x-real-ip`. Configure database cleanup and backups. Keep database connection count within free-plan quotas (`max:5` per warm instance; tune host concurrency accordingly).
7. Verify HTTPS and the full anonymous flow, outlier moderation, login rate limits, organization searches/merge, sitemap and `/opengraph-image` on the deployed hostname. Test a CAPTCHA replay and missing/forged source headers.
8. A custom domain later changes `SITE_URL` and Turnstile allowlist/hostname; it does not require a rewrite.

For Cloudflare Workers later, use the maintained OpenNext adapter and a supported PostgreSQL pooler/Hyperdrive, plus a trusted source-header adapter. This repository does not pretend that a static Cloudflare Pages export can run database/API routes. The host should execute `npm run build` and `npm start`, or a supported Next.js adapter. No paid monitoring or analytics service is required; start with hosting logs.

## Current handoff

The repository is the deliverable. An external GitHub remote, production database, CAPTCHA keys and public hosting URL require provisioned account access. Do not call the project production-live until real credentials are configured and deployment smoke tests pass. See `docs/verification.md` for actual checks performed in this workspace.

## Regression and CI/CD release gates

The complete case-family matrix and closure rules are in [docs/test-plan.md](docs/test-plan.md). Actual verification evidence is tracked separately in [docs/verification.md](docs/verification.md). [docs/deployment.md](docs/deployment.md) explains the CI-controlled Vercel deployment flow, required secrets, rollback, launch gates and the limits of free hosting.

The workflow distinguishes passing CI from an unconfigured/skipped production deployment. No test fixture or local load measurement is evidence of national-scale production capacity. Additional commands are `npm run test:browser:production`, `BROWSER_NAME=firefox npm run test:browser`, `npm run test:performance` and read-only `DEPLOYMENT_URL=https://your-host npm run test:smoke`.
