# Verification

Verified in this workspace:

- Next.js production build passes; all application and API routes compile.
- ESLint passes without warnings; strict TypeScript passes.
- 30 unit/security/integration tests pass against isolated embedded PostgreSQL. Coverage includes validation, normalization, median/statistics, approved-only filtering, anonymous API submission, rate limits, duplicate patterns, outliers, Bangla/case-insensitive search, admin sessions/passwords, and Turnstile hostname/action/production-bypass rules.
- Both Playwright browser tests pass: anonymous submission with immediate aggregate refresh, flagged outlier excluded until approval, authenticated moderation, transactional organization merge, logout, role search and organization details.
- Home, organizations and trust pages have no horizontal overflow at 320, 375, 390, 430, 768 and 1440px.
- Homepage axe WCAG A/AA checks report zero violations. This does not replace a full manual accessibility audit.
- Bangla social card visually inspected and saved as a static 1200×630 PNG.

All test data resides in temporary databases. Local-only CAPTCHA bypass is used in browser tests; separate tests verify production disables it.

Pending launch prerequisites:

- Real Turnstile verification on a deployed hostname.
- Production database credentials, migrations, cleanup schedule and backups.
- Trusted production source-IP forwarding and HTTPS smoke tests.
- Lighthouse scores have not been measured; no >90 score is claimed.
- GitHub remote push and public hosting deployment are not completed. Initial CLI authentication was unavailable, and production provider credentials were not supplied.

See README for setup and deployment. The public-URL definition of done remains pending these prerequisites.
