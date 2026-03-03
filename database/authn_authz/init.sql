-- ============================================================
-- authn_authz database schema
-- Used by AuthnAuthzService
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- auth_audit_log: records every login attempt
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID        NOT NULL,           -- FK to account DB (cross-DB ref, enforced by app)
    action       VARCHAR(64) NOT NULL,           -- e.g. LOGIN, LOGOUT, TOKEN_REFRESH
    ip_address   VARCHAR(45),
    user_agent   TEXT,
    success      BOOLEAN     NOT NULL DEFAULT FALSE,
    detail       TEXT,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aal_account_id   ON auth_audit_log(account_id);
CREATE INDEX idx_aal_occurred_at  ON auth_audit_log(occurred_at DESC);

-- refresh_tokens: JWT refresh token registry
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID        NOT NULL,           -- FK to account DB (cross-DB ref, enforced by app)
    token_hash   VARCHAR(255) NOT NULL UNIQUE,   -- bcrypt hash of the raw refresh token
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_account_id  ON refresh_tokens(account_id);
CREATE INDEX idx_rt_token_hash  ON refresh_tokens(token_hash);
CREATE INDEX idx_rt_expires_at  ON refresh_tokens(expires_at);
