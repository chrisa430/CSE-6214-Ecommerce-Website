-- ============================================================
-- seller database schema
-- Used by SellerService
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Core tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rating (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id   UUID         NOT NULL,           -- FK to account.account (cross-DB ref, enforced by app)
    buyer_id    UUID         NOT NULL,           -- FK to account.account (cross-DB ref, enforced by app)
    rating      INTEGER      NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review      TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rating_seller_id ON rating(seller_id);
CREATE INDEX idx_rating_buyer_id  ON rating(buyer_id);

CREATE TABLE IF NOT EXISTS seller_audit_log (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID         NOT NULL,           -- FK to account.account (cross-DB ref, enforced by app)
    action       VARCHAR(64)  NOT NULL,
    ip_address   VARCHAR(45),
    user_agent   TEXT,
    success      BOOLEAN      NOT NULL DEFAULT FALSE,
    detail       TEXT,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seller_audit_account_id  ON seller_audit_log(account_id);
CREATE INDEX idx_seller_audit_occurred_at ON seller_audit_log(occurred_at DESC);
