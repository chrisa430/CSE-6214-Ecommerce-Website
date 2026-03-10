-- ============================================================
-- shopping_cart database schema  |  ShoppingCartService
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS shopping_cart (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer        VARCHAR(255) NOT NULL,           -- buyer email (account.account.user_id)
    date_created TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sc_buyer ON shopping_cart(buyer);

CREATE TABLE IF NOT EXISTS shopping_cart_item (
    id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_cart_id UUID           NOT NULL REFERENCES shopping_cart(id) ON DELETE CASCADE,
    product_id       UUID           NOT NULL,        -- FK to inventory.product (app-enforced)
    unit_cost        NUMERIC(10,2)  NOT NULL CHECK (unit_cost >= 0),
    tax_percent      NUMERIC(5,4)   NOT NULL DEFAULT 0 CHECK (tax_percent >= 0),
    quantity         INTEGER        NOT NULL DEFAULT 1 CHECK (quantity > 0)
);
CREATE INDEX idx_sci_cart_id    ON shopping_cart_item(shopping_cart_id);
CREATE INDEX idx_sci_product_id ON shopping_cart_item(product_id);

CREATE TABLE IF NOT EXISTS shopping_cart_audit_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID        NOT NULL,
    action      VARCHAR(64) NOT NULL,
    detail      TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sca_account_id  ON shopping_cart_audit_log(account_id);
CREATE INDEX idx_sca_occurred_at ON shopping_cart_audit_log(occurred_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sc_updated_at
BEFORE UPDATE ON shopping_cart
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
