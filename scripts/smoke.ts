// Read-only deployment check. Never submit synthetic data to a public database.
const value = process.env.DEPLOYMENT_URL;
if (!value) throw new Error("Set DEPLOYMENT_URL");
const base = new URL(value);
if (
  base.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(base.hostname)
)
  throw new Error("Public deployment must use HTTPS");
for (const path of [
  "/",
  "/organizations",
  "/about",
  "/privacy",
  "/methodology",
  "/admin",
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image.png",
  "/api/statistics",
]) {
  const response = await fetch(new URL(path, base), {
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  if (base.protocol === "https:" && !response.url.startsWith("https://"))
    throw new Error("HTTPS downgraded");
  if (path === "/api/statistics") {
    const s = await response.json();
    for (const key of ["count", "total", "mean", "median", "organizations"])
      if (typeof s[key] !== "number" || !Number.isFinite(s[key]) || s[key] < 0)
        throw new Error("Invalid public statistics");
  }
  if (path === "/") {
    const html = await response.text();
    if (!html.includes("ফি দেই") || !html.includes("organization_name"))
      throw new Error("Application page missing");
    if (response.headers.get("x-content-type-options") !== "nosniff")
      throw new Error("Missing security header");
  }
}
console.log(
  "Read-only deployment smoke passed (10 routes). Real CAPTCHA/source-IP and backup gates remain separate.",
);
export {};
