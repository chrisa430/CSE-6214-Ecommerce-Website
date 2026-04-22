-- ============================================================
-- seller database schema  |  SellerService
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS seller_status (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);
INSERT INTO seller_status (name, short_desc, long_desc) VALUES
  ('active',    'Active',    'Seller is in good standing and can list products'),
  ('suspended', 'Suspended', 'Seller account has been temporarily suspended'),
  ('closed',    'Closed',    'Seller account has been permanently closed')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS seller_profile (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id   UUID         NOT NULL UNIQUE,       -- FK to account.account (app-enforced)
    status_id   UUID         NOT NULL REFERENCES seller_status(id),
    store_name  VARCHAR(255),
    bio         TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sp_seller_id ON seller_profile(seller_id);

CREATE TABLE IF NOT EXISTS seller_rating (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id  UUID        NOT NULL,                -- FK to account.account (app-enforced)
    buyer_id   UUID        NOT NULL,                -- FK to account.account (app-enforced)
    rating     INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (seller_id, buyer_id)
);
CREATE INDEX idx_sr_seller_id ON seller_rating(seller_id);
CREATE INDEX idx_sr_buyer_id  ON seller_rating(buyer_id);

CREATE TABLE IF NOT EXISTS seller_audit_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID        NOT NULL,
    action      VARCHAR(64) NOT NULL,
    detail      TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sela_account_id  ON seller_audit_log(account_id);
CREATE INDEX idx_sela_occurred_at ON seller_audit_log(occurred_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seller_profile_updated_at
BEFORE UPDATE ON seller_profile
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
