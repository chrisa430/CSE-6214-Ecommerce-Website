-- ============================================================
-- order database schema
-- Used by OrderService
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Lookup / reference tables ──────────────────────────────────────────────

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

CREATE TABLE IF NOT EXISTS address_type (
                                            id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(32)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
    );

INSERT INTO address_type (name, short_desc, long_desc) VALUES
                                                           ('billing',  'Billing address',  'Address used for payment billing'),
                                                           ('shipping', 'Shipping address', 'Address used for order delivery')
    ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS payment_method_type (
                                                   id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(32)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
    );

INSERT INTO payment_method_type (name, short_desc, long_desc) VALUES
                                                                  ('visa',       'Visa',       'Visa credit/debit card'),
                                                                  ('mastercard', 'Mastercard', 'Mastercard credit/debit card'),
                                                                  ('amex',       'Amex',       'American Express card'),
                                                                  ('discover',   'Discover',   'Discover card')
    ON CONFLICT DO NOTHING;

-- ── Core tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "order" (
                                       id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id         UUID           NOT NULL,       -- FK to account.account (cross-DB ref, enforced by app)
    currency         UUID           NOT NULL REFERENCES currency_type(id),
    shopping_cart_id UUID           NOT NULL,       -- FK to shopping_cart.shopping_cart (cross-DB ref, enforced by app)
    subtotal         NUMERIC(10,2)  NOT NULL DEFAULT 0,
    tax              NUMERIC(10,2)  NOT NULL DEFAULT 0,
    total            NUMERIC(10,2)  NOT NULL DEFAULT 0,
    status_id        UUID           NOT NULL REFERENCES order_status(id),
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    );

CREATE INDEX idx_order_buyer_id        ON "order"(buyer_id);
CREATE INDEX idx_order_shopping_cart   ON "order"(shopping_cart_id);
CREATE INDEX idx_order_status_id       ON "order"(status_id);

CREATE TABLE IF NOT EXISTS completed_order_items (
                                                     id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID           NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    product_id UUID           NOT NULL,       -- FK to inventory.product (cross-DB ref, enforced by app)
    quantity   INTEGER        NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10,2)  NOT NULL,
    name       VARCHAR(255),
    image_url  TEXT
    );

CREATE INDEX idx_coi_order_id   ON completed_order_items(order_id);
CREATE INDEX idx_coi_product_id ON completed_order_items(product_id);

CREATE TABLE IF NOT EXISTS address (
                                       id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID         NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    address_type UUID         NOT NULL REFERENCES address_type(id),
    street1      VARCHAR(255),
    street2      VARCHAR(255),
    city         VARCHAR(128),
    state_id     UUID,                           -- FK to account.state (cross-DB ref, enforced by app)
    zipcode      VARCHAR(10)
    );

CREATE INDEX idx_address_order_id ON address(order_id);

CREATE TABLE IF NOT EXISTS payment_method (
                                              id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID     NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
    type        UUID     NOT NULL REFERENCES payment_method_type(id),
    card_number VARCHAR(20),        -- last-4 digits only stored in production
    exp_month   INTEGER,
    exp_year    INTEGER,
    cvv2        INTEGER             -- never stored in production; schema reference only
    );

CREATE INDEX idx_pm_order_id ON payment_method(order_id);

CREATE TABLE IF NOT EXISTS order_audit_log (
                                               id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID         NOT NULL,           -- FK to account.account (cross-DB ref, enforced by app)
    action       VARCHAR(64)  NOT NULL,
    ip_address   VARCHAR(45),
    user_agent   TEXT,
    success      BOOLEAN      NOT NULL DEFAULT FALSE,
    detail       TEXT,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

CREATE INDEX idx_order_audit_account_id  ON order_audit_log(account_id);
CREATE INDEX idx_order_audit_occurred_at ON order_audit_log(occurred_at DESC);

-- Trigger to auto-update updated_at on order rows
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_updated_at
    BEFORE UPDATE ON "order"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
