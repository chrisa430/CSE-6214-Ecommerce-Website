-- ============================================================
-- shopping_cart database schema
-- Used by ShoppingCartService
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Core tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shopping_cart (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id   UUID         NOT NULL,           -- FK to account.account (cross-DB ref, enforced by app)
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shopping_cart_buyer_id ON shopping_cart(buyer_id);

CREATE TABLE IF NOT EXISTS shopping_cart_items (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_cart_id UUID         NOT NULL REFERENCES shopping_cart(id) ON DELETE CASCADE,
    product_id       UUID         NOT NULL,     -- FK to inventory.product (cross-DB ref, enforced by app)
    quantity         INTEGER      NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price       NUMERIC(10,2),
    added_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sci_shopping_cart_id ON shopping_cart_items(shopping_cart_id);
CREATE INDEX idx_sci_product_id       ON shopping_cart_items(product_id);

CREATE TABLE IF NOT EXISTS shopping_cart_audit_log (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID         NOT NULL,           -- FK to account.account (cross-DB ref, enforced by app)
    action       VARCHAR(64)  NOT NULL,
    ip_address   VARCHAR(45),
    user_agent   TEXT,
    success      BOOLEAN      NOT NULL DEFAULT FALSE,
    detail       TEXT,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sc_audit_account_id  ON shopping_cart_audit_log(account_id);
CREATE INDEX idx_sc_audit_occurred_at ON shopping_cart_audit_log(occurred_at DESC);

-- Trigger to auto-update updated_at on shopping_cart rows
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_shopping_cart_updated_at
BEFORE UPDATE ON shopping_cart
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
