-- ============================================================
-- inventory database schema
-- Used by InventoryService
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Lookup / reference tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS category_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO category_type (name, short_desc, long_desc) VALUES
  ('baseball',      'Baseball',      'Baseball sports memorabilia'),
  ('basketball',    'Basketball',    'Basketball sports memorabilia'),
  ('football',      'Football',      'Football sports memorabilia'),
  ('hockey',        'Hockey',        'Hockey sports memorabilia'),
  ('soccer',        'Soccer',        'Soccer sports memorabilia'),
  ('golf',          'Golf',          'Golf sports memorabilia'),
  ('tennis',        'Tennis',        'Tennis sports memorabilia'),
  ('other',         'Other',         'Miscellaneous sports memorabilia')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS subcategory_type (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(64)  NOT NULL UNIQUE,
    short_desc              VARCHAR(128),
    long_desc               TEXT,
    category                UUID         NOT NULL REFERENCES category_type(id),
    team_name               VARCHAR(128),
    player_name             VARCHAR(128),
    is_signed               BOOLEAN      NOT NULL DEFAULT FALSE,
    is_authenticated        BOOLEAN      NOT NULL DEFAULT FALSE,
    is_framed               BOOLEAN      NOT NULL DEFAULT FALSE,
    has_inscription         BOOLEAN      NOT NULL DEFAULT FALSE,
    has_multiple_signatures BOOLEAN      NOT NULL DEFAULT FALSE,
    is_protected            BOOLEAN      NOT NULL DEFAULT FALSE,
    protection_type         UUID,                       -- FK to protection_type (set after table creation)
    condition_type          UUID,                       -- FK to condition_type (set after table creation)
    product_status          UUID,                       -- FK to product_status_type (set after table creation)
    quantity                INTEGER      NOT NULL DEFAULT 0 CHECK (quantity >= 0)
);

CREATE INDEX idx_subcategory_category ON subcategory_type(category);

CREATE TABLE IF NOT EXISTS protection_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO protection_type (name, short_desc, long_desc) VALUES
  ('case',         'Display Case',   'Item stored in a hard acrylic display case'),
  ('sleeve',       'Sleeve',         'Item stored in a protective sleeve'),
  ('frame',        'Frame',          'Item mounted in a protective frame'),
  ('vault',        'Vault Storage',  'Item kept in a climate-controlled vault'),
  ('none',         'No Protection',  'Item has no additional protection')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS condition_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO condition_type (name, short_desc, long_desc) VALUES
  ('mint',          'Mint',           'Item is in perfect, unused condition'),
  ('near_mint',     'Near Mint',      'Item shows minimal signs of handling'),
  ('excellent',     'Excellent',      'Item shows light wear but remains highly presentable'),
  ('very_good',     'Very Good',      'Item shows some wear but is complete and presentable'),
  ('good',          'Good',           'Item shows notable wear and use'),
  ('fair',          'Fair',           'Item shows heavy wear; still intact'),
  ('poor',          'Poor',           'Item is heavily worn or damaged')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS product_status_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);

INSERT INTO product_status_type (name, short_desc, long_desc) VALUES
  ('draft',     'Draft',     'Listing is saved but not yet published'),
  ('active',    'Active',    'Listing is live and available for purchase'),
  ('sold',      'Sold',      'Item has been sold'),
  ('suspended', 'Suspended', 'Listing has been suspended by an admin'),
  ('removed',   'Removed',   'Listing has been removed by the seller')
ON CONFLICT DO NOTHING;

-- ── Add deferred FK constraints on subcategory_type ───────────────────────

ALTER TABLE subcategory_type
    ADD CONSTRAINT fk_subcategory_protection FOREIGN KEY (protection_type) REFERENCES protection_type(id),
    ADD CONSTRAINT fk_subcategory_condition  FOREIGN KEY (condition_type)  REFERENCES condition_type(id),
    ADD CONSTRAINT fk_subcategory_status     FOREIGN KEY (product_status)  REFERENCES product_status_type(id);

-- ── Core tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id    UUID         NOT NULL,           -- FK to account.account (cross-DB ref, enforced by app)
    name         VARCHAR(255) NOT NULL,
    short_desc   VARCHAR(128),
    long_desc    TEXT,
    category     UUID         NOT NULL REFERENCES category_type(id),
    sub_category UUID         REFERENCES subcategory_type(id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_seller_id    ON product(seller_id);
CREATE INDEX idx_product_category     ON product(category);
CREATE INDEX idx_product_sub_category ON product(sub_category);

CREATE TABLE IF NOT EXISTS product_image (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID         NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    name        VARCHAR(255),
    short_desc  VARCHAR(128),
    long_desc   TEXT,
    image_url   VARCHAR(2048) NOT NULL
);

CREATE INDEX idx_product_image_product_id ON product_image(product_id);

CREATE TABLE IF NOT EXISTS inventory_audit_log (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID         NOT NULL,           -- FK to account.account (cross-DB ref, enforced by app)
    action       VARCHAR(64)  NOT NULL,
    ip_address   VARCHAR(45),
    user_agent   TEXT,
    success      BOOLEAN      NOT NULL DEFAULT FALSE,
    detail       TEXT,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_audit_account_id  ON inventory_audit_log(account_id);
CREATE INDEX idx_inv_audit_occurred_at ON inventory_audit_log(occurred_at DESC);

-- Trigger to auto-update updated_at on product rows
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_updated_at
BEFORE UPDATE ON product
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
