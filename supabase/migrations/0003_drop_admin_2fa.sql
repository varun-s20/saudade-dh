-- ════════════════════════════════════════════════════════════════════════════
-- SAUDADE · migration 0003 · admin sign-in is email and password only (DECISIONS D-089)
--
--   The client did not ask for two-factor sign-in (AQ5), so it was removed: the TOTP and
--   recovery-code columns on admin_users, and admin_sessions.mfa_verified, go with it.
--   Lock-out after 5 wrong passwords, the per-IP limit and the audit log are unchanged.
-- Applied by scripts/db-setup.mjs inside one transaction.
-- ════════════════════════════════════════════════════════════════════════════

alter table admin_users
  drop constraint if exists admin_users_totp_ck,
  drop column if exists totp_secret_enc,
  drop column if exists totp_enrolled_at,
  drop column if exists totp_last_used_step,
  drop column if exists recovery_code_hashes;

comment on table admin_users is 'Zeya + developer. Created by CLI only (no sign-up). Email and password sign-in.';

alter table admin_sessions drop column if exists mfa_verified;
