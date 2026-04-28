-- ============================================================
-- inventory database schema  |  InventoryService
-- Sprint 5 — rebuilt to spec
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── product_status_type ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_status_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(64)  NOT NULL UNIQUE,
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);
INSERT INTO product_status_type (code, name, short_desc, long_desc) VALUES
  ('active',    'active',    'Active',    'Product can be displayed and sold on the site'),
  ('suspended', 'suspended', 'Suspended', 'Product has been temporarily suspended'),
  ('removed',   'removed',   'Removed',   'The Seller has removed the product from sale on the site'),
  ('open',      'open',      'Open',      'Product has been submitted for creation approval by an Admin'),
  ('traded',    'traded',    'Traded',    'Product has been exchanged via a seller-to-seller trade')
ON CONFLICT DO NOTHING;

-- ── product_category ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_category (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(64)  NOT NULL UNIQUE,
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT,
    gender     VARCHAR(20)  CHECK (gender IN ('men''s', 'women''s', 'mixed', 'unspecified'))
);
INSERT INTO product_category (code, name, short_desc, long_desc, gender) VALUES
  ('mlb',       'mlb',       'MLB',              'Major League Baseball',                            'men''s'),
  ('mlaaa',     'mlaaa',     'Triple-A',         'Minor League Baseball - Triple-A',                 'men''s'),
  ('mlaa',      'mlaa',      'Double-A',         'Minor League Baseball - Double-A',                 'men''s'),
  ('mlha',      'mlha',      'High-A',           'Minor League Baseball - High-A',                   'men''s'),
  ('mla',       'mla',       'Single-A',         'Minor League Baseball - Single-A',                 'men''s'),
  ('mlr',       'mlr',       'Rookie',           'Minor League Baseball - US-based Rookie',          'men''s'),
  ('football',  'football',  'NFL',              'National Football League',                         'men''s'),
  ('golf',      'golf',      'Golf',             'PGA - Professional Golfers Association',           'men''s'),
  ('wgolf',     'wgolf',     'Women''s Golf',    'LPGA - Professional Golfers Association',          'women''s'),
  ('msoccer',   'msoccer',   'MLS Soccer',       'Major League Soccer',                              'men''s'),
  ('wsoccer',   'wsoccer',   'NWSL Soccer',      'National Women''s Soccer League',                  'women''s'),
  ('softball',  'softball',  'AUSL Softball',    'Athletes Unlimited Softball League',               'women''s'),
  ('tennis',    'tennis',    'ATP Tennis',       'Association of Tennis Professionals',              'men''s'),
  ('wtennis',   'wtennis',   'WTA Tennis',       'Women''s Tennis Association',                      'women''s'),
  ('wrestling', 'wrestling', 'WWE Wrestling',    'World Wrestling Entertainment',                    'men''s'),
  ('wwrestling','wwrestling','WWE Women''s Wrestling','World Wrestling Entertainment Women''s',      'women''s')
ON CONFLICT DO NOTHING;

-- ── product_subcategory ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_subcategory (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID         NOT NULL REFERENCES product_category(id) ON DELETE CASCADE,
    code        VARCHAR(64)  NOT NULL,
    name        VARCHAR(64)  NOT NULL,
    short_desc  VARCHAR(128),
    long_desc   TEXT,
    UNIQUE (category_id, code)
);
CREATE INDEX idx_psc_category_id ON product_subcategory(category_id);

-- ── protection_type ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS protection_type (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_category UUID         REFERENCES product_category(id),
    name            VARCHAR(64)  NOT NULL UNIQUE,
    short_desc      VARCHAR(128),
    long_desc       TEXT
);
INSERT INTO protection_type (parent_category, name, short_desc, long_desc) VALUES
  (NULL, 'Display Case',  'Display Case',   'Item stored in a hard acrylic display case'),
  (NULL, 'Sleeve',        'Sleeve',         'Item stored in a protective sleeve'),
  (NULL, 'Frame',         'Frame',          'Item mounted in a protective frame'),
  (NULL, 'Vault Storage', 'Vault Storage',  'Item kept in a climate-controlled vault'),
  (NULL, 'None',          'No Protection',  'Item has no additional protection')
ON CONFLICT DO NOTHING;

-- ── condition_type ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS condition_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(64)  NOT NULL UNIQUE,
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT,
    sort_order INTEGER      NOT NULL DEFAULT 0
);
INSERT INTO condition_type (code, name, short_desc, long_desc, sort_order) VALUES
  ('mint',      'mint',      'Mint',      'Perfect, unused condition — no flaws whatsoever',   1),
  ('near_mint', 'near_mint', 'Near Mint', 'Minimal signs of handling; nearly perfect',         2),
  ('excellent', 'excellent', 'Excellent', 'Light wear; remains highly presentable',             3),
  ('very_good', 'very_good', 'Very Good', 'Some wear but complete and presentable',             4),
  ('good',      'good',      'Good',      'Notable wear and use; still fully intact',           5),
  ('fair',      'fair',      'Fair',      'Heavy wear; still intact but clearly used',          6),
  ('poor',      'poor',      'Poor',      'Heavily worn or damaged; collectible value only',    7)
ON CONFLICT DO NOTHING;

-- ── product_category_type ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_category_type (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(64)  NOT NULL UNIQUE,
    name       VARCHAR(64)  NOT NULL UNIQUE,
    short_desc VARCHAR(128),
    long_desc  TEXT
);
INSERT INTO product_category_type (code, name, short_desc, long_desc) VALUES
  ('autographed',     'autographed',     'Autographed',      'Item has been signed by a player or personality'),
  ('game_used',       'game_used',       'Game Used',        'Item was used in an actual game'),
  ('rookie',          'rookie',          'Rookie',           'Item is from or related to a player''s rookie year'),
  ('limited_edition', 'limited_edition', 'Limited Edition',  'Item is part of a limited production run'),
  ('vintage',         'vintage',         'Vintage',          'Item is from a prior era (pre-1990)'),
  ('modern',          'modern',          'Modern',           'Item is from the modern era (post-1990)'),
  ('championship',    'championship',    'Championship',     'Item is related to a championship event or title')
ON CONFLICT DO NOTHING;

-- ── product ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id        UUID         NOT NULL,          -- FK to account.account (app-enforced)
    name             VARCHAR(255) NOT NULL,
    short_desc       VARCHAR(128),
    long_desc        TEXT,
    category_id      UUID         NOT NULL REFERENCES product_category(id),
    subcategory_id   UUID         REFERENCES product_subcategory(id),
    team_name        VARCHAR(128),
    player_name      VARCHAR(128),
    gender           VARCHAR(20)  CHECK (gender IN ('men''s', 'women''s', 'mixed', 'unspecified')),
    is_signed        BOOLEAN      NOT NULL DEFAULT FALSE,
    is_authenticated BOOLEAN      NOT NULL DEFAULT FALSE,
    is_framed        BOOLEAN      NOT NULL DEFAULT FALSE,
    has_inscription  BOOLEAN      NOT NULL DEFAULT FALSE,
    inscription_text TEXT,
    has_multi_sigs   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_protected     BOOLEAN      NOT NULL DEFAULT FALSE,
    protection_type_id UUID       REFERENCES protection_type(id),
    condition_id     UUID         REFERENCES condition_type(id),
    status_id        UUID         NOT NULL REFERENCES product_status_type(id),
    unit_price       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    quantity         INTEGER      NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_product_seller_id   ON product(seller_id);
CREATE INDEX idx_product_category_id ON product(category_id);
CREATE INDEX idx_product_status_id   ON product(status_id);

-- ── product_image ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_image (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID          NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    name        VARCHAR(255),
    short_desc  VARCHAR(128),
    long_desc   TEXT,
    image_url   VARCHAR(2048) NOT NULL,
    sort_order  INTEGER       NOT NULL DEFAULT 0,
    is_primary  BOOLEAN       NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_pi_product_id ON product_image(product_id);

-- Ensure only one primary image per product
CREATE UNIQUE INDEX idx_pi_one_primary
    ON product_image(product_id)
    WHERE is_primary = TRUE;

-- ── inventory_audit_log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_audit_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID        NOT NULL,
    action      VARCHAR(64) NOT NULL,
    detail      TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ia_account_id  ON inventory_audit_log(account_id);
CREATE INDEX idx_ia_occurred_at ON inventory_audit_log(occurred_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_updated_at
BEFORE UPDATE ON product
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── product_review ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_review (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID        NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    buyer_id    UUID        NOT NULL,
    rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, buyer_id)
);
CREATE INDEX IF NOT EXISTS idx_pr_product_id ON product_review(product_id);
CREATE INDEX IF NOT EXISTS idx_pr_buyer_id   ON product_review(buyer_id);

-- ── trade_request ─────────────────────────────────────────────────────────────
-- Tracks seller-to-seller trade proposals. Both products are locked to 'traded'
-- status on acceptance; all other pending trades for those products are cancelled.
CREATE TABLE IF NOT EXISTS trade_request (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    proposer_id           UUID        NOT NULL,   -- seller who proposes the trade
    receiver_id           UUID        NOT NULL,   -- seller who owns the requested product
    offered_product_id    UUID        NOT NULL REFERENCES product(id),
    requested_product_id  UUID        NOT NULL REFERENCES product(id),
    status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tr_proposer_id  ON trade_request(proposer_id);
CREATE INDEX idx_tr_receiver_id  ON trade_request(receiver_id);
CREATE INDEX idx_tr_status       ON trade_request(status);

CREATE TRIGGER trg_trade_request_updated_at
BEFORE UPDATE ON trade_request
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
