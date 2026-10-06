# Verification and remaining release gates

## Locally verified

- Production Next.js build, strict TypeScript, ESLint without warnings and `git diff --check` pass.
- **144** unit/security/API/deployment-configuration/PostgreSQL integration cases pass using isolated temporary databases.
- **5 Chromium browser regression tests** and **2 production-mode browser tests** pass. Coverage includes anonymous submission, validation/failure input retention, double-submit protection, statistics refresh, moderation, merge, logout, role search, missing organizations, and production CAPTCHA-bypass rejection.
- Responsive checks run at 320/375/390/430/768/1440px; enlarged text and keyboard focus are checked. Axe runs on all public pages and admin login with no A/AA violations in those automated checks. This is not a full manual accessibility audit.
- Runtime dependency audit reports no known vulnerabilities at the time run; this is not a guarantee of security.
- Latest local mobile Lighthouse scores: performance **93**, accessibility **100**, best practices **100**, SEO **100**. A streamed-loading layout shift and unnecessary link ARIA override found during measurement were corrected. Bangla WOFF2 is preloaded; the original TTF remains available for social-card regeneration.
- Bounded localhost probe: **10000 synthetic reports**, **100 organizations**, **200 read requests**, concurrency **10**, **0 failures**, **531 ms p95**, **670 ms p99**. These numbers are local measurements, not a production SLA. See `performance-summary.json`.
- No development fixtures are uploaded to a production database; tests refuse nonempty test databases and seeds are blocked in production.

## GitHub execution evidence

The baseline uploaded project already passed [its GitHub Actions run](https://github.com/LatifurRahman/chakri-fee/actions/runs/37410968034). Expanded CI/CD is configured to run on every main push and PR; inspect [the Actions runs](https://github.com/LatifurRahman/chakri-fee/actions) for the exact tested commit and individual job conclusions. Chromium, Firefox and production-mode suites run on the hosted CI runner. Local Firefox is blocked by this execution environment's browser runtime; it is not counted as a local pass.

## Open production/manual gates

- Hosting and production PostgreSQL account/configuration are not provisioned. Production deployment is disabled until `ENABLE_PRODUCTION_DEPLOY=true` plus credentials/environment settings are supplied. A readiness-job pass or skipped deploy is not a public deployment.
- Real Turnstile challenge success/replay/expiry and a deployed widget's performance overhead.
- Hosting-overwritten source IP across instances; TLS/pooler behavior; HTTPS smoke on the actual domain.
- Backups and restore rehearsal; scheduled abuse-record cleanup; quota notifications and rollback rehearsal.
- Manual screen-reader/touch testing and Safari/iOS device coverage.
- Sustained staging load and remote database behavior before promoting to a large population.

The case-family matrix is in `test-plan.md`, and deployment/hosting setup is in `deployment.md`. Automated gates can close independently of the externally blocked production gates; no claim of every possible test case or full production readiness is made.

## Cloudflare deployment migration

The separate `feat/cloudflare-workers-hyperdrive` branch adds the current Cloudflare-recommended vinext/Workers toolchain and Hyperdrive. It preserves the original Next workflow and all existing tests. See [Workers verification](cloudflare-verification.md) for the migration-specific 167-test/runtime/browser evidence and remaining live-platform gates; the earlier Vercel-oriented results above are historical.
