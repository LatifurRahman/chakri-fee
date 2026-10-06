DELETE FROM abuse_buckets WHERE expires_at < now();
DELETE FROM submission_patterns WHERE expires_at < now();
