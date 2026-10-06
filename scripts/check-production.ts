const cloudflare = process.env.DEPLOYMENT_TARGET === "cloudflare";
const required = [
  ...(cloudflare ? ["HYPERDRIVE_ID"] : ["DATABASE_URL"]),
  "SITE_URL",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_HOSTNAME",
  "ANTI_ABUSE_SECRET",
  "ADMIN_SESSION_SECRET",
  "ADMIN_PASSWORD_HASH",
];
for (const name of required)
  if (!process.env[name]?.trim())
    throw new Error(`Missing production configuration: ${name}`);
const origin = new URL(process.env.SITE_URL!);
if (
  origin.protocol !== "https:" ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw new Error("SITE_URL must be a public HTTPS origin");
if (origin.hostname !== process.env.TURNSTILE_HOSTNAME)
  throw new Error("Turnstile hostname must match the canonical origin");
if (
  process.env.ANTI_ABUSE_SECRET!.length < 32 ||
  process.env.ADMIN_SESSION_SECRET!.length < 32 ||
  process.env.ANTI_ABUSE_SECRET === process.env.ADMIN_SESSION_SECRET
)
  throw new Error("Independent 32+ character security secrets required");
if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(process.env.ADMIN_PASSWORD_HASH!))
  throw new Error("Generate the production admin hash with npm run admin:hash");
if (process.env.DEV_BYPASS_TURNSTILE === "true")
  throw new Error(
    "Remove the development CAPTCHA bypass from production configuration",
  );
if (cloudflare) {
  if (
    !/^[a-f0-9]{32}$/i.test(process.env.HYPERDRIVE_ID!) ||
    /^0+$/.test(process.env.HYPERDRIVE_ID!)
  )
    throw new Error("A real HYPERDRIVE_ID is required");
}
if (!cloudflare || process.env.DATABASE_URL) {
  const db = new URL(process.env.DATABASE_URL!);
  if (
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    ["localhost", "127.0.0.1"].includes(db.hostname)
  )
    throw new Error("A remote production PostgreSQL URL is required");
}
console.log(
  "Required production configuration is present; no secret values printed. Real source-IP, CAPTCHA and backup acceptance remain required.",
);
export {};
