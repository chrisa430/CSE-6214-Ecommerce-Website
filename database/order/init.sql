-- ============================================================
-- order database schema  |  OrderService
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS order_status (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);
INSERT INTO order_status (name, short_desc, long_desc) VALUES
  ('pending',   'Pending',    'Order placed, awaiting payment confirmation'),
  ('confirmed', 'Confirmed',  'Payment confirmed, order is being processed'),
  ('shipped',   'Shipped',    'Order has been shipped'),
  ('delivered', 'Delivered',  'Order has been delivered'),
  ('cancelled', 'Cancelled',  'Order was cancelled'),
  ('refunded',  'Refunded',   'Payment was refunded')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS currency_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);
INSERT INTO currency_type (name, short_desc, long_desc) VALUES
  ('USD', 'US Dollar',         'United States Dollar'),
  ('EUR', 'Euro',              'European Union Euro'),
  ('GBP', 'British Pound',     'Great British Pound Sterling'),
  ('CAD', 'Canadian Dollar',   'Canadian Dollar'),
  ('AUD', 'Australian Dollar', 'Australian Dollar')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "order" (
    id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer       VARCHAR(255)   NOT NULL,            -- buyer email (app-enforced ref to account)
    currency_id UUID           NOT NULL REFERENCES currency_type(id),
    status_id   UUID           NOT NULL REFERENCES order_status(id),
    unit_cost   NUMERIC(10,2)  NOT NULL CHECK (unit_cost >= 0),
    tax_percent NUMERIC(5,4)   NOT NULL DEFAULT 0 CHECK (tax_percent >= 0),
    quantity    INTEGER        NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total_price NUMERIC(12,2)  GENERATED ALWAYS AS
                    (ROUND((unit_cost * quantity * tax_percent) + (unit_cost * quantity), 2))
                    STORED,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_buyer    ON "order"(buyer);
CREATE INDEX idx_order_status   ON "order"(status_id);
CREATE INDEX idx_order_currency ON "order"(currency_id);

CREATE TABLE IF NOT EXISTS order_item (
    id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID           NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    product_id  UUID           NOT NULL,            -- FK to inventory.product (app-enforced)
    unit_cost   NUMERIC(10,2)  NOT NULL CHECK (unit_cost >= 0),
    tax_percent NUMERIC(5,4)   NOT NULL DEFAULT 0 CHECK (tax_percent >= 0),
    quantity    INTEGER        NOT NULL DEFAULT 1 CHECK (quantity > 0)
);
CREATE INDEX idx_oi_order_id   ON order_item(order_id);
CREATE INDEX idx_oi_product_id ON order_item(product_id);

CREATE TABLE IF NOT EXISTS order_audit_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID        NOT NULL,
    action      VARCHAR(64) NOT NULL,
    detail      TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_oa_account_id  ON order_audit_log(account_id);
CREATE INDEX idx_oa_occurred_at ON order_audit_log(occurred_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_updated_at
BEFORE UPDATE ON "order"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
