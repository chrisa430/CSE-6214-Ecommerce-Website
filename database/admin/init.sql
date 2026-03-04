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
  ('order_confirmation',  'Order Confirmation',   'Buyer notification when an order is placed'),
  ('order_shipped',       'Order Shipped',        'Buyer notification when an order ships'),
  ('account_suspended',   'Account Suspended',    'Notification of account suspension'),
  ('listing_approved',    'Listing Approved',     'Seller notification when a listing is approved'),
  ('listing_rejected',    'Listing Rejected',     'Seller notification when a listing is rejected'),
  ('password_reset',      'Password Reset',       'Account password reset notification'),
  ('admin_alert',         'Admin Alert',          'Internal platform administrative alert')
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
