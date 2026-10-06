CREATE TABLE organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 160),
 normalized_name text NOT NULL UNIQUE, slug text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fee_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
 organization_name text NOT NULL, normalized_organization_name text NOT NULL,
 role_name text CHECK(char_length(role_name)<=120), fee_amount integer NOT NULL CHECK(fee_amount>=0),
 status text NOT NULL CHECK(status IN ('pending','approved','flagged','rejected')) DEFAULT 'pending',
 moderation_reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_public ON fee_reports(organization_id,created_at DESC) WHERE status='approved';
CREATE INDEX reports_moderation ON fee_reports(status,created_at DESC);
CREATE INDEX organizations_normalized ON organizations(normalized_name text_pattern_ops);
-- Short-lived HMAC hashes, never raw IP addresses. No link from these tables to public reports.
CREATE TABLE abuse_buckets (key text PRIMARY KEY, count integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL);
CREATE INDEX abuse_expiry ON abuse_buckets(expires_at);
CREATE TABLE submission_patterns (key text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE INDEX patterns_expiry ON submission_patterns(expires_at);
CREATE TABLE admin_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action text NOT NULL, target_id uuid, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit ENABLE ROW LEVEL SECURITY;
-- The server connects with an owner role. No browser database access or anonymous RLS policies.
