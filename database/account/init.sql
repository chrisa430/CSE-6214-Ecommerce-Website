-- ============================================================
-- account database schema
-- Used by AccountService
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Lookup / reference tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_type (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(32) NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO account_type (name, short_desc, long_desc) VALUES
  ('admin',  'Administrator',     'Full platform administrative access'),
  ('buyer',  'Buyer account',     'Can browse and purchase sports memorabilia'),
  ('seller', 'Seller account',    'Can list and sell sports memorabilia')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS account_status (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(32) NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO account_status (name, short_desc, long_desc) VALUES
  ('active',    'Active',   'Account is in good standing'),
  ('suspended', 'Suspended','Account has been temporarily suspended'),
  ('closed',    'Closed',   'Account has been permanently closed')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS address_type (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(32) NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO address_type (name, short_desc, long_desc) VALUES
  ('billing',  'Billing address',  'Address used for payment billing'),
  ('shipping', 'Shipping address', 'Address used for order delivery')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS payment_method_type (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(32) NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO payment_method_type (name, short_desc, long_desc) VALUES
  ('visa',       'Visa',       'Visa credit/debit card'),
  ('mastercard', 'Mastercard', 'Mastercard credit/debit card'),
  ('amex',       'Amex',       'American Express card'),
  ('discover',   'Discover',   'Discover card')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS state (
    id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name   VARCHAR(64) NOT NULL UNIQUE,
    abbrev CHAR(2)     NOT NULL UNIQUE
);

INSERT INTO state (name, abbrev) VALUES
  ('Alabama','AL'),('Alaska','AK'),('Arizona','AZ'),('Arkansas','AR'),('California','CA'),
  ('Colorado','CO'),('Connecticut','CT'),('Delaware','DE'),('Florida','FL'),('Georgia','GA'),
  ('Hawaii','HI'),('Idaho','ID'),('Illinois','IL'),('Indiana','IN'),('Iowa','IA'),
  ('Kansas','KS'),('Kentucky','KY'),('Louisiana','LA'),('Maine','ME'),('Maryland','MD'),
  ('Massachusetts','MA'),('Michigan','MI'),('Minnesota','MN'),('Mississippi','MS'),('Missouri','MO'),
  ('Montana','MT'),('Nebraska','NE'),('Nevada','NV'),('New Hampshire','NH'),('New Jersey','NJ'),
  ('New Mexico','NM'),('New York','NY'),('North Carolina','NC'),('North Dakota','ND'),('Ohio','OH'),
  ('Oklahoma','OK'),('Oregon','OR'),('Pennsylvania','PA'),('Rhode Island','RI'),('South Carolina','SC'),
  ('South Dakota','SD'),('Tennessee','TN'),('Texas','TX'),('Utah','UT'),('Vermont','VT'),
  ('Virginia','VA'),('Washington','WA'),('West Virginia','WV'),('Wisconsin','WI'),('Wyoming','WY')
ON CONFLICT DO NOTHING;

-- ── Core tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       VARCHAR(255) NOT NULL UNIQUE,   -- email address
    password_hash VARCHAR(255) NOT NULL,          -- bcrypt hash
    first_name    VARCHAR(128) NOT NULL,
    last_name     VARCHAR(128) NOT NULL,
    closed_date   TIMESTAMPTZ,
    type_id       UUID        NOT NULL REFERENCES account_type(id),
    status_id     UUID        NOT NULL REFERENCES account_status(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_user_id ON account(user_id);

CREATE TABLE IF NOT EXISTS account_audit_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id     UUID        NOT NULL REFERENCES account(id),
    target_id    VARCHAR(255) NOT NULL,
    action       VARCHAR(64)  NOT NULL,
    detail       TEXT,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aal_actor_id     ON account_audit_log(actor_id);
CREATE INDEX idx_aal_occurred_at  ON account_audit_log(occurred_at DESC);

CREATE TABLE IF NOT EXISTS address (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID        NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    address_type UUID        NOT NULL REFERENCES address_type(id),
    street1      VARCHAR(255),
    street2      VARCHAR(255),
    city         VARCHAR(128),
    state_id     UUID        REFERENCES state(id),
    zipcode      VARCHAR(10)
);

CREATE INDEX idx_address_account_id ON address(account_id);

CREATE TABLE IF NOT EXISTS payment_method (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID    NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    type        UUID    NOT NULL REFERENCES payment_method_type(id),
    card_number VARCHAR(20),       -- last-4 digits only stored in production
    exp_month   INTEGER,
    exp_year    INTEGER,
    cvv2        INTEGER            -- never stored in production; schema reference only
);

CREATE INDEX idx_pm_account_id ON payment_method(account_id);

-- Trigger to auto-update updated_at on account rows
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_account_updated_at
BEFORE UPDATE ON account
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
