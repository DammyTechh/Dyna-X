-- =============================================================================
-- 006_seed_admin.sql
-- Creates (or promotes) an admin account. Admins cannot be created via the
-- public /auth/register endpoint (no admin profile table), so we seed directly.
--
-- The password is stored as a real bcrypt hash via pgcrypto's crypt()/gen_salt
-- ('bf'); Go's bcrypt.CompareHashAndPassword reads the cost from the hash, so
-- this verifies correctly at login. Idempotent (upsert on email).
--
--   email:    petersdamilare5@gmail.com
--   password: Damilare143@
-- Change the password after first login.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.dynax_users (email, role, password_hash, is_active, is_verified)
VALUES (
  'petersdamilare5@gmail.com',
  'admin',
  crypt('Damilare143@', gen_salt('bf', 12)),
  TRUE,
  TRUE
)
ON CONFLICT (email) DO UPDATE
SET role          = 'admin',
    password_hash = crypt('Damilare143@', gen_salt('bf', 12)),
    is_active     = TRUE,
    is_verified   = TRUE,
    updated_at    = NOW();
