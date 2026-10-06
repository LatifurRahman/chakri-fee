# CI/CD setup and hosting recommendation

## What is configured

`.github/workflows/ci.yml` runs on main pushes, pull requests and manual dispatch. CI performs a clean lockfile install, runtime dependency audit, lint, real-PostgreSQL unit/API/integration tests, production build, strict TypeScript, Chromium and Firefox regressions, and production-mode browser tests. Reports/traces are saved as short-lived Actions artifacts. Source and fixtures do not need production secrets to test.

After CI, the deployment-readiness job records whether production deployment is enabled. The deploy job runs only on main, only after CI, and only when repository variable `ENABLE_PRODUCTION_DEPLOY=true`. It uses the `production` GitHub environment, checks credentials, pulls and validates Vercel production settings, builds a production artifact, runs transactional/idempotent database migrations, deploys the artifact, and performs read-only HTTPS smoke checks.

A successful CI run with a skipped deploy job means **tested code, not a deployed website**. Hosting and the production database have not yet been provisioned for this project.

## Setup sequence

1. Create an empty Supabase production project separate from all test/development data. Choose a nearby available region and place the app's server region near the database. Use TLS and the transaction pooler for serverless runtime; an owner connection is needed for migrations. Tune pool limits and host concurrency to the database plan.
2. Create a Vercel project for this Next.js repository. Keep it private until production acceptance passes. If GitHub Actions controls production deployments, disable independent automatic production deployments from Git so a push cannot bypass CI. Do not run two deployment systems for the same production branch.
3. Get a stable provider hostname; no domain purchase is necessary. Register it in Cloudflare Turnstile.
4. Configure all application variables from `.env.example` in Vercel's Production environment, including the public Turnstile key at build time. `SITE_URL` must be the public HTTPS origin and `TURNSTILE_HOSTNAME` must match. Generate separate random security secrets and a new scrypt admin hash. Remove the development CAPTCHA bypass.
5. Add GitHub encrypted secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and `PRODUCTION_DATABASE_URL`. The last is the production migration connection, never a test database. Set the GitHub `production` environment and its protection rules according to your release policy. Do not put secret values in chat or tracked files.
6. Schedule `scripts/cleanup.sql` through the database scheduler. Verify backups and restore a backup into a separate staging database. Supabase Free does not supply the paid backup guarantees; maintain secure, encrypted off-provider exports appropriate to the dataset.
7. Set repository variable `ENABLE_PRODUCTION_DEPLOY=true` only after the services above are ready. Trigger CI/CD by pushing to main or using Run workflow. Inspect the CI, readiness and deploy job conclusions separately.
8. Follow the returned deployment URL and the canonical public hostname. The automated smoke check reads ten routes including statistics; it never inserts fake production reports.
9. In staging, verify real Turnstile success/replay/expiry, platform-overwritten `x-real-ip`, rate limits across warm instances, approval/rejection/merge, TLS to PostgreSQL and database outage behavior. Verify the first genuine report in production only with legitimate data.
10. Finish manual mobile/screen-reader testing, quota notifications and the rollback exercise before a public campaign.

The Vercel CLI version is pinned in the workflow. Update it deliberately after checking provider documentation. `.vercel` is ignored because pulled provider settings contain credentials.

## Rollback and failure handling

A failed CI job prevents the deploy job. Failed configuration/build/migrations also prevent publish. Smoke-test failure marks deployment unsuccessful; it does not automatically undo database changes. Use Vercel's previous known-good deployment/rollback capability, verify read-only smoke again, and retain the failed deployment's logs without sensitive payloads. Future migrations must be backward compatible with the previous application before they can use this pipeline; no automatic destructive database rollback is performed. Initial migration is transactional and idempotent.

## Local reproduction

```sh
npm ci
npm run lint -- --max-warnings=0
npm run test:local-db
npm run build
npm run typecheck
npx playwright install chromium firefox
npm run test:browser
BROWSER_NAME=firefox npm run test:browser
npm run test:browser:production
npm run test:performance
```

`CHROMIUM_PATH` can select an existing system Chromium. `PLAYWRIGHT_BROWSERS_PATH` can select a writable browser cache in restricted workspaces. Local PostgreSQL test clusters and the 10,000-record performance fixture are temporary. Use a normal non-root development account; do not add privileged system-user setup to tests.

## Reliable and free: the practical limit

No free managed stack should be represented as guaranteeing unlimited national-scale traffic or production uptime. Audience size does not specify request rate, peak concurrency, database storage or bandwidth. Free limits can stop requests or require an upgrade during a viral campaign.

| Option                                              | Fit for this repository                                                                                                                                           | Free-tier limits relevant to the decision                                                                                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel Hobby + Supabase Free + Turnstile            | Recommended $0 pilot with the current Next.js/PostgreSQL architecture, if eligible for personal/noncommercial Hobby use                                           | Vercel imposes usage/fair-use limits and features may remain unavailable until quota reset. Supabase includes a 500 MB database and free projects can pause for inactivity; paid backup/availability guarantees are absent.                |
| Cloudflare Workers + managed PostgreSQL + Turnstile | Consider for later deployment only after an adapter/driver/security compatibility test. Do not treat GitHub Pages or static Cloudflare Pages as a server runtime. | Workers Free has 100,000 dynamic requests/day and 10 ms CPU per invocation. Next.js rendering and synchronous scrypt admin verification must be measured against that CPU budget; this repo has not been adapted or certified for Workers. |
| Paid Next.js host + production PostgreSQL           | Appropriate when reliability under a large sustained audience becomes a requirement                                                                               | Budget for quota headroom, connection capacity, recoverable backups and support. A free-tier launch is a starting point, not a permanent capacity promise.                                                                                 |

Prefer the first option to launch the current code with minimal adaptation. Keep a traffic budget, observe database query latency and connection use, and upgrade before promoting to a large audience. A CDN helps static assets; every current dynamic statistics/search request still reaches the application and database. If reads become the bottleneck, design and test aggregate caching/invalidation as a separate change while preserving immediate contribution feedback.

Official sources checked for this recommendation:

- [Vercel Hobby eligibility and usage behavior](https://vercel.com/docs/plans/hobby)
- [Vercel trusted request headers](https://vercel.com/docs/headers/request-headers)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase inactivity pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

Provider terms/quotas must be rechecked at account creation. No paid account or domain has been purchased, and no public deployment is claimed by this document.
