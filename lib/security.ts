import "server-only";
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db";
export function digest(value: string) {
  const secret = process.env.ANTI_ABUSE_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("ANTI_ABUSE_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(
    origin && origin === new URL(process.env.SITE_URL || request.url).origin,
  );
}
export function anonymousSource(request: Request) {
  // Hosting must overwrite this header. Do not trust a client-supplied forwarding chain.
  const ip = request.headers
    .get(
      process.env.NODE_ENV === "production" ? "x-real-ip" : "x-forwarded-for",
    )
    ?.split(",")[0]
    ?.trim();
  if (!ip) throw new Error("TRUSTED_SOURCE_HEADER_MISSING");
  return digest(`${new Date().toISOString().slice(0, 10)}:${ip}`);
}
export async function rateLimit(source: string, limit = 5, seconds = 600) {
  const sql = db();
  await sql`DELETE FROM abuse_buckets WHERE expires_at<now()`;
  const [r] =
    await sql`INSERT INTO abuse_buckets(key,count,expires_at) VALUES(${source},1,now()+${seconds}*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN abuse_buckets.expires_at<now() THEN 1 ELSE abuse_buckets.count+1 END,expires_at=CASE WHEN abuse_buckets.expires_at<now() THEN excluded.expires_at ELSE abuse_buckets.expires_at END RETURNING count`;
  return r.count <= limit;
}
export async function verifyTurnstile(token: unknown) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_BYPASS_TURNSTILE === "true"
  )
    return true;
  if (
    typeof token !== "string" ||
    token.length > 2048 ||
    !process.env.TURNSTILE_SECRET_KEY ||
    !process.env.TURNSTILE_HOSTNAME
  )
    return false;
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
  const result = await res.json();
  return (
    result.success === true &&
    result.hostname === process.env.TURNSTILE_HOSTNAME &&
    result.action === "fee-report"
  );
}
export function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function validPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD_HASH;
  if (!expected || password.length > 256) return false;
  const [salt, hash] = expected.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    scryptSync(password, salt, 64),
  );
}
function sessionSecret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("ADMIN_NOT_CONFIGURED");
  return s;
}
export function createSession() {
  const body = `${Date.now() + 8 * 60 * 60 * 1000}.${randomBytes(24).toString("hex")}`;
  return `${body}.${createHmac("sha256", sessionSecret()).update(body).digest("hex")}`;
}
export function validSession(token: string | undefined) {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (
      parts.length !== 3 ||
      !/^\d+$/.test(parts[0]) ||
      !/^[a-f0-9]{48}$/.test(parts[1]) ||
      !/^[a-f0-9]{64}$/.test(parts[2]) ||
      Number(parts[0]) < Date.now()
    )
      return false;
    const sig = createHmac("sha256", sessionSecret())
      .update(parts.slice(0, 2).join("."))
      .digest();
    return timingSafeEqual(sig, Buffer.from(parts[2], "hex"));
  } catch {
    return false;
  }
}
