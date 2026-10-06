import { describe, expect, it } from "vitest";
import { validateHyperdriveConfiguration } from "../lib/deployment/hyperdrive";
const id = "a".repeat(32);
const config = {
  id,
  caching: { disabled: true },
  origin: { host: "db.example.test", database: "postgres" },
};
const databaseUrl =
  "postgresql://owner:fixture-only@db.example.test:5432/postgres?sslmode=require";
describe("Hyperdrive production acceptance", () => {
  it("accepts the same origin with caching disabled", () =>
    expect(() =>
      validateHyperdriveConfiguration(config, id, databaseUrl),
    ).not.toThrow());
  it.each([
    null,
    {},
    { ...config, id: "b".repeat(32) },
    { ...config, caching: { disabled: false } },
    { ...config, origin: { host: "wrong.test", database: "postgres" } },
    { ...config, origin: { host: "db.example.test", database: "wrong" } },
  ])("fails closed for an invalid provider configuration %j", (value) =>
    expect(() =>
      validateHyperdriveConfiguration(value, id, databaseUrl),
    ).toThrow(),
  );
});
