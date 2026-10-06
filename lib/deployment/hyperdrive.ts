// Never log the provider response: origin settings can contain credentials.
export function validateHyperdriveConfiguration(
  value: unknown,
  id: string,
  databaseUrl?: string,
) {
  if (!value || typeof value !== "object")
    throw new Error("Invalid Hyperdrive response");
  const result = value as {
    id?: unknown;
    caching?: { disabled?: unknown };
    origin?: { host?: unknown; database?: unknown };
  };
  if (result.id !== id || result.caching?.disabled !== true)
    throw new Error(
      "Hyperdrive must match HYPERDRIVE_ID and have query caching disabled",
    );
  if (databaseUrl) {
    const database = new URL(databaseUrl);
    if (
      result.origin?.host !== database.hostname ||
      result.origin.database !== decodeURIComponent(database.pathname.slice(1))
    )
      throw new Error(
        "Hyperdrive and the migration URL must target the same PostgreSQL origin/database",
      );
  }
}
