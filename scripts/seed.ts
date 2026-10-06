import postgres from "postgres";
if (
  process.env.NODE_ENV === "production" ||
  process.env.ALLOW_DEV_SEED !== "true" ||
  !process.env.DATABASE_URL
)
  throw new Error(
    "Development only: explicitly set ALLOW_DEV_SEED=true against a separate development database.",
  );
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await sql.begin(async (tx) => {
    const [o] =
      await tx`INSERT INTO organizations(name,normalized_name,slug) VALUES('[DEMO] Example Organization','demo example organization','demo-example-organization') ON CONFLICT(normalized_name) DO UPDATE SET name=excluded.name RETURNING id`;
    for (const fee of [200, 300, 500, 500, 700])
      await tx`INSERT INTO fee_reports(organization_id,organization_name,normalized_organization_name,role_name,fee_amount,status) VALUES(${o.id},'[DEMO] Example Organization','demo example organization','DEMO Officer',${fee},'approved')`;
  });
} finally {
  await sql.end();
}
