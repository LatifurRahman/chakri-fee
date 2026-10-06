# Workers migration verification

Migration branch: `feat/cloudflare-workers-hyperdrive`. Production deployment remains disabled; this work does not merge main, create a production Worker or modify a production database.

## Automated evidence

- Clean `npm ci`: passed.
- Zero-warning ESLint, strict TypeScript, original Next production build: passed.
- Requested production audit (`npm audit --omit=dev --audit-level=high`): zero findings.
- 167 unit/integration tests against real disposable PostgreSQL: passed repeatedly, including the requested `BROWSER_NAME=firefox` environment on the unit suite. All original 144 tests retained, with 23 additional Workers lifecycle/security/configuration cases. A browser-name environment value does not turn Vitest into a Firefox browser test.
- Original Chromium browser suite: 5 passed, covering anonymous submit, outlier moderation/merge, validation, keyboard, axe, and six responsive widths.
- Original Next production browser suite: 2 passed.
- vinext compatibility scan: all 15 scanned items supported, no reported partial/unsupported features.
- Workers build and Wrangler packaging dry-run: passed, approximately 356.70 KiB compressed script upload at verification; no actual deployment.
- Actual compiled workerd preview against a disposable PostgreSQL origin: passed. Covers fresh approved-only aggregates, streaming, multiple concurrent requests, prepared statements, organization search/detail, real scrypt admin login, signed cookies, approve/logout, CAPTCHA bypass refusal, origin and database-backed rate protection, routes, SEO, static fonts/Open Graph and security headers. The unchanged 2 production browser tests also pass against workerd, including axe and client error checks.
- Next-generated declaration files are restored after Workers build/preview; a subsequent Next typecheck passes. No original migration/schema or fee logic is changed.

Local Firefox Playwright was attempted and could not launch its temporary profile (`Could not find profile folder`), before application test execution. GitHub CI explicitly installs Firefox with its system dependencies and runs the original suite there. Check the latest [branch Actions run](https://github.com/LatifurRahman/chakri-fee/actions?query=branch%3Afeat%2Fcloudflare-workers-hyperdrive) for hosted-run evidence; a local environment failure is not a pass.

The extra full-toolchain audit is **not green**: upstream `braces` and `fflate` advisories propagate through build/lint and unused image generation dependencies, with no npm fixes available at verification. The required production-only audit is clear; see [deployment risks](deployment.md#additional-dependency-audit-finding). No package-name / unzipSync matches were found in the inspected compiled Worker JS. Monitor upstream fixes.

## Still needs production/staging acceptance

No Cloudflare account credentials, live Supabase endpoint or real Turnstile widget are configured in this workspace. Local Hyperdrive emulation does not verify remote pooling, direct-origin TLS/IPv6 networking, real CAPTCHA success/replay/expiry, source-IP behavior at the Cloudflare edge, Worker CPU quotas, backup restoration, cleanup scheduling or rollback. The release preflight checks the remote cache/origin configuration once those credentials are provided. Follow [exact deployment setup](deployment.md) and keep the enable flag false until these gates are met. Local login round-trip timing does not establish CPU consumption; scrypt may exceed Workers Free CPU limits.

## Files changed

- `.env.example`
- `.github/workflows/ci.yml`
- `.gitignore`
- `.prettierignore`
- `README.md`
- `docs/cloudflare-verification.md`
- `docs/deployment.md`
- `docs/test-plan.md`
- `eslint.config.mjs`
- `lib/db/context.ts`
- `lib/db/index.ts`
- `lib/deployment/hyperdrive.ts`
- `lib/security.ts`
- `package-lock.json`
- `package.json`
- `playwright.cloudflare.config.ts`
- `scripts/check-cloudflare.ts`
- `scripts/check-production.ts`
- `scripts/cloudflare-test.ts`
- `scripts/cloudflare.ts`
- `scripts/deploy-cloudflare.ts`
- `tests/cloudflare-security.test.ts`
- `tests/deployment-config.test.ts`
- `tests/hyperdrive-config.test.ts`
- `tests/worker-lifecycle.test.ts`
- `tsconfig.json`
- `vite.config.ts`
- `worker/index.ts`
- `wrangler.jsonc`

- `docs/verification.md`
