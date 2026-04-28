-- ============================================================
-- admin database schema
-- Used by AdminService
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Lookup / reference tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decision_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO decision_type (name, short_desc, long_desc) VALUES
  ('approve',  'Approved',  'The decision was approved'),
  ('reject',   'Rejected',  'The decision was rejected'),
  ('escalate', 'Escalated', 'The decision was escalated for further review'),
  ('defer',    'Deferred',  'The decision has been deferred pending more information')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS decision_status_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO decision_status_type (name, short_desc, long_desc) VALUES
  ('pending',   'Pending',   'Decision is awaiting action'),
  ('in_review', 'In Review', 'Decision is actively being reviewed'),
  ('resolved',  'Resolved',  'Decision has been finalized'),
  ('cancelled', 'Cancelled', 'Decision was cancelled before resolution')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS service_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO service_type (name, short_desc, long_desc) VALUES
  ('email',        'Email',         'Notification delivered via email'),
  ('sms',          'SMS',           'Notification delivered via text message'),
  ('push',         'Push',          'Notification delivered via push notification'),
  ('in_app',       'In-App',        'Notification delivered within the application')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS notification_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO notification_type (name, short_desc, long_desc) VALUES
  ('order_confirmation',         'Order Confirmation',         'Buyer notification when an order is placed'),
  ('order_shipped',              'Order Shipped',              'Buyer notification when an order ships'),
  ('account_suspended',          'Account Suspended',          'Notification of account suspension'),
  ('listing_approved',           'Listing Approved',           'Seller notification when a listing is approved'),
  ('listing_rejected',           'Listing Rejected',           'Seller notification when a listing is rejected'),
  ('password_reset',             'Password Reset',             'Account password reset notification'),
  ('admin_alert',                'Admin Alert',                'Internal platform administrative alert'),
  ('account creation submitted', 'Account Creation Submitted', 'Account has submitted for creation approval by an Admin'),
  ('account activated',          'Account Activated',          'Account has been activated by an Admin'),
  ('account suspended',          'Account Suspended',          'Account has been suspended by an Admin'),
  ('account closed',             'Account Closed',             'Account has been closed by the account owner')
ON CONFLICT DO NOTHING;

-- ── Core tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decision (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_type       UUID         NOT NULL REFERENCES decision_type(id),
    decision_status     UUID         NOT NULL REFERENCES decision_status_type(id),
    short_desc          VARCHAR(128),
    long_desc           TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decision_type       ON decision(decision_type);
CREATE INDEX idx_decision_status     ON decision(decision_status);

CREATE TABLE IF NOT EXISTS notification (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id        UUID         NOT NULL,   -- FK to account.account (cross-DB ref, enforced by app)
    service_type        UUID         NOT NULL REFERENCES service_type(id),
    notification_type   UUID         NOT NULL REFERENCES notification_type(id),
    subject             VARCHAR(255),
    message_body        TEXT,
    outbox_flag         BOOLEAN      NOT NULL DEFAULT FALSE,
    sent_flag           BOOLEAN      NOT NULL DEFAULT FALSE,
    date_sent           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_recipient_id ON notification(recipient_id);
CREATE INDEX idx_notification_date_sent    ON notification(date_sent DESC);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID         NOT NULL,           -- FK to account.account (cross-DB ref, enforced by app)
    action       VARCHAR(64)  NOT NULL,
    ip_address   VARCHAR(45),
    user_agent   TEXT,
    success      BOOLEAN      NOT NULL DEFAULT FALSE,
    detail       TEXT,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_account_id  ON admin_audit_log(account_id);
CREATE INDEX idx_admin_audit_occurred_at ON admin_audit_log(occurred_at DESC);

-- Trigger to auto-update updated_at on decision rows
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_decision_updated_at
BEFORE UPDATE ON decision
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── System configuration ────────────────────────────────────────────────────
-- Stores admin-managed platform configuration values.

CREATE TABLE IF NOT EXISTS system_config (
    key         VARCHAR(128) PRIMARY KEY,
    value       TEXT         NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO system_config (key, value, description) VALUES
  ('order_age', '60', 'Number of days a buyer has to return an item from a completed order')
ON CONFLICT DO NOTHING;

-- ── Return notification types ────────────────────────────────────────────────
INSERT INTO notification_type (name, short_desc, long_desc) VALUES
  ('return_initiated_buyer',  'Return Initiated — Buyer',  'Confirmation to buyer that their return request has been received'),
  ('return_initiated_seller', 'Return Initiated — Seller', 'Notification to seller of a return request for their item'),
  ('return_initiated_admin',  'Return Initiated — Admin',  'Notification to admins that a return has been initiated')
ON CONFLICT DO NOTHING;

-- ── Return action notification types (seller decisions) ─────────────────────
INSERT INTO notification_type (name, short_desc, long_desc) VALUES
  ('return_approved_seller',  'Return Approved — Seller Confirmation',  'Seller confirmation that they approved a return'),
  ('return_approved_buyer',   'Return Approved — Buyer Notification',   'Buyer notification that their return was approved'),
  ('return_declined_seller',  'Return Declined — Seller Confirmation',  'Seller confirmation that they declined a return'),
  ('return_declined_buyer',   'Return Declined — Buyer Notification',   'Buyer notification that their return was declined'),
  ('return_disputed_seller',  'Return Disputed — Seller Confirmation',  'Seller confirmation that they disputed a return'),
  ('return_disputed_buyer',   'Return Disputed — Buyer Notification',   'Buyer notification that their return has been disputed'),
  ('return_action_admin',     'Return Action — Admin Alert',            'Admin alert when a seller declines or disputes a return')
ON CONFLICT DO NOTHING;

-- ── RSS Feed Tables ──────────────────────────────────────────────────────────
-- rss_feed_type: the four named feed channels sellers can subscribe to
CREATE TABLE IF NOT EXISTS rss_feed_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO rss_feed_type (name, short_desc, long_desc) VALUES
  ('product_activations', 'Product Activations', 'Feed of products approved/activated by admins'),
  ('product_blocks',      'Product Blocks',      'Feed of products suspended/blocked by admins'),
  ('product_sales',       'Product Sales',       'Feed of product sales completed by buyers'),
  ('product_returns',     'Product Returns',     'Feed of product return requests submitted by buyers'),
  ('account_blocks',      'Account Blocks',      'Feed of seller/buyer account suspensions by admins')
ON CONFLICT DO NOTHING;

-- rss_subscription: which sellers subscribe to which feed types
CREATE TABLE IF NOT EXISTS rss_subscription (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id    UUID        NOT NULL,   -- FK to account.account (app-enforced)
    feed_type_id UUID        NOT NULL REFERENCES rss_feed_type(id),
    email_alerts BOOLEAN     NOT NULL DEFAULT TRUE,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (seller_id, feed_type_id)
);

CREATE INDEX idx_rss_sub_seller   ON rss_subscription(seller_id);
CREATE INDEX idx_rss_sub_feedtype ON rss_subscription(feed_type_id);

-- rss_feed_item: individual events surfaced in each feed
CREATE TABLE IF NOT EXISTS rss_feed_item (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_type_id UUID        NOT NULL REFERENCES rss_feed_type(id),
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    link         VARCHAR(512),
    author       VARCHAR(128),
    reference_id UUID,        -- product_id, order_id, return_id, or account_id
    metadata     JSONB,       -- structured fields specific to each feed type
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rss_item_feedtype    ON rss_feed_item(feed_type_id);
CREATE INDEX idx_rss_item_occurred_at ON rss_feed_item(occurred_at DESC);

-- ── RSS notification types ───────────────────────────────────────────────────
INSERT INTO notification_type (name, short_desc, long_desc) VALUES
  ('rss_product_activation', 'RSS — Product Activated',  'Email alert to subscribed seller: admin activated a product'),
  ('rss_product_block',      'RSS — Product Blocked',    'Email alert to subscribed seller: admin blocked/suspended a product'),
  ('rss_product_sale',       'RSS — Product Sale',       'Email alert to subscribed seller: one of their products was sold'),
  ('rss_product_return',     'RSS — Product Return',     'Email alert to subscribed seller: buyer initiated a return on their product'),
  ('rss_account_block',      'RSS — Account Blocked',    'Email alert to subscribed seller: an account was suspended/blocked by admins')
ON CONFLICT DO NOTHING;
