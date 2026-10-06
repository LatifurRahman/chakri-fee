import { validateHyperdriveConfiguration } from "../lib/deployment/hyperdrive";
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const id = process.env.HYPERDRIVE_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (
  !account ||
  !/^[a-f0-9]{32}$/i.test(account) ||
  !id ||
  !/^[a-f0-9]{32}$/i.test(id) ||
  !token
)
  throw new Error(
    "Missing Cloudflare account, token or Hyperdrive configuration",
  );
const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/hyperdrive/configs/${id}`,
  {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  },
);
if (!response.ok)
  throw new Error(
    `Hyperdrive configuration verification failed (${response.status})`,
  );
const data = (await response.json()) as { success?: boolean; result?: unknown };
if (data.success !== true)
  throw new Error("Hyperdrive configuration verification failed");
validateHyperdriveConfiguration(data.result, id, process.env.DATABASE_URL);
console.log(
  "Verified Hyperdrive target and disabled query caching; no origin credentials printed.",
);
