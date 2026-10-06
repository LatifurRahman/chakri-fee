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

| Variable                         | Purpose                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | Server-only PostgreSQL URL; Node development may use the Supabase transaction pooler. Workers use Hyperdrive against the direct Supabase endpoint. Use TLS for remote connections. |
| `SITE_URL`                       | Full canonical site origin, no trailing slash. Used for metadata, sitemap and origin checks.                                                                                       |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public widget key, present at build time.                                                                                                                                          |
| `TURNSTILE_SECRET_KEY`           | Server-only CAPTCHA verification key.                                                                                                                                              |
| `TURNSTILE_HOSTNAME`             | Expected hostname returned by Turnstile (no scheme).                                                                                                                               |
| `ANTI_ABUSE_SECRET`              | At least 32 random characters for daily rotating HMAC source hashes.                                                                                                               |
| `ADMIN_SESSION_SECRET`           | Independent 32+ random characters for eight-hour signed admin sessions.                                                                                                            |
| `ADMIN_PASSWORD_HASH`            | Salted scrypt hash from the helper.                                                                                                                                                |
| `NORMAL_FEE_MAX`                 | Default 10000; larger integer BDT amounts enter moderation.                                                                                                                        |
| `LEADERBOARD_MIN_REPORTS`        | Default 5 approved reports for median rankings.                                                                                                                                    |
| `DEV_BYPASS_TURNSTILE`           | Local-only bypass, never honored in production.                                                                                                                                    |
| `TEST_DATABASE_URL`              | Separate, empty disposable PostgreSQL database for integration tests.                                                                                                              |

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

**Trusted source header:** Workers read Cloudflare's overwritten `CF-Connecting-IP` and ignore forwarded/client-provided IP headers. The Node production path retains trusted `x-real-ip`; local Next development uses `x-forwarded-for`. Missing/malformed addresses refuse writes. See [deployment setup](docs/deployment.md) for Cloudflare transforms/proxy restrictions and privacy considerations.

Turnstile checks token validity, configured hostname and `fee-report` action; failure blocks writes. No raw IP is sent by this application to siteverify. Hosting/Turnstile may process technical information under their own policies. There is no analytics in V1. Error logs contain error types, not form payloads. Set hosting log retention appropriately. The privacy page describes actual processing and expiry/cleanup behavior.

Input is length bounded and validated server-side; control/bidi abuse, unpaired surrogates and HTML-like markup are rejected. React escapes displayed strings. No `dangerouslySetInnerHTML` is used. API origin checks defend cookie mutations; all admin operations require signed sessions. Security headers limit frames/resources. No public report IDs are returned.

## Deployment: Cloudflare Workers

**GitHub → GitHub Actions CI → Cloudflare Workers → Hyperdrive → Supabase PostgreSQL**, with Turnstile. The Cloudflare-recommended vinext adapter runs alongside standard Next.js development/build. No D1 or schema migration is introduced. Keep `ENABLE_PRODUCTION_DEPLOY=false` until production setup and staging acceptance are complete. Deployments require passing CI and main; this migration branch cannot deploy production.

```sh
npm run check:cloudflare
npm run types:cloudflare
npm run dev:cloudflare
npm run build:cloudflare
npm run preview:cloudflare
npm run test:cloudflare
```

Workers commands use a separate Vite toolchain; the wrapper restores Next-generated types. Configure ignored `.dev.vars` and the local Hyperdrive connection override as documented. Workers production preview rejects the development CAPTCHA bypass. `postgres` uses request-owned clients and prepared statements on Hyperdrive; disable Hyperdrive query caching for fresh statistics. No remote credentials or real data are needed for the Workers regression harness.

[docs/deployment.md](docs/deployment.md) contains exact Cloudflare/Supabase/dashboard/GitHub setup, every secret/binding, migration preflight, post-deployment read-only smoke, rollback and free-tier limits. Remove old Vercel/Git automatic deployment integrations so Actions remains the sole production gate. Workers CPU and Supabase quotas may require paid capacity for reliable public usage.

## Current handoff

The repository is the deliverable. An external GitHub remote, production database, CAPTCHA keys and public hosting URL require provisioned account access. Do not call the project production-live until real credentials are configured and deployment smoke tests pass. See `docs/verification.md` for actual checks performed in this workspace.

## Regression and CI/CD release gates

The complete case-family matrix and closure rules are in [docs/test-plan.md](docs/test-plan.md). Actual verification evidence is tracked separately in [docs/verification.md](docs/verification.md). [docs/deployment.md](docs/deployment.md) explains the CI-controlled Cloudflare Workers deployment flow, required secrets, rollback, launch gates and the limits of free hosting.

The workflow distinguishes passing CI from an unconfigured/skipped production deployment. No test fixture or local load measurement is evidence of national-scale production capacity. Additional commands are `npm run test:browser:production`, `BROWSER_NAME=firefox npm run test:browser`, `npm run test:performance` and read-only `DEPLOYMENT_URL=https://your-host npm run test:smoke`.
