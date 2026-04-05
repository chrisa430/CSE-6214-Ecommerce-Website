/**
 * @fileoverview SportVault master seed script — orchestrates all service seed APIs
 * @module scripts/seed-all.ts
 * @author Darrell Hobson
 * @Date 2026.04.03
 *
 * Execution order:
 *   0. AccountService   — seed primary admin (from env: ADMIN_EMAIL / ADMIN_PASSWORD)
 *   1. AccountService   — seed 135 dummy accounts:
 *                           100 Buyers  (buyer001–buyer100 @sportvault.com)
 *                            25 Sellers (seller001–seller025@sportvault.com)
 *                            10 Admins  (admin001–admin010 @sportvault.com)
 *   2. AdminService     — verify admin reference data
 *   3. AuthnAuthzService— verify auth DB
 *   4. ShoppingCartService — seed sample carts
 *   5. OrderService     — seed 500 completed (delivered) orders across all buyers
 *   6. SellerService    — verify seller reference data
 *   7. InventoryService — seed subcategories + 1,000 products (40 per seller) + images
 *
 * Usage:
 *   cd scripts && npm install && npx ts-node seed-all.ts
 *
 * Environment overrides (all default to local Docker ports):
 *   ACCOUNT_URL      http://localhost:3002
 *   ADMIN_URL        http://localhost:3003
 *   AUTHN_URL        http://localhost:3001
 *   CART_URL         http://localhost:3004
 *   ORDER_URL        http://localhost:3005
 *   SELLER_URL       http://localhost:3006
 *   INVENTORY_URL    http://localhost:3007
 *   INTERNAL_SECRET  internal-secret
 */

const ACCOUNT_URL   = process.env.ACCOUNT_URL   || "http://localhost:3002";
const ADMIN_URL     = process.env.ADMIN_URL     || "http://localhost:3003";
const AUTHN_URL     = process.env.AUTHN_URL     || "http://localhost:3001";
const CART_URL      = process.env.CART_URL      || "http://localhost:3004";
const ORDER_URL     = process.env.ORDER_URL     || "http://localhost:3005";
const SELLER_URL    = process.env.SELLER_URL    || "http://localhost:3006";
const INVENTORY_URL = process.env.INVENTORY_URL || "http://localhost:3007";
const SECRET        = process.env.INTERNAL_SECRET || "internal-secret";

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function seedPost(label: string, url: string, body: unknown = {}): Promise<any> {
  section(label);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": SECRET },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      warn(`HTTP ${res.status}: ${JSON.stringify(json)}`);
      return null;
    }
    ok(JSON.stringify(json, null, 2));
    return json;
  } catch (err: any) {
    warn(`Service unreachable — ${err.message}`);
    warn(`  Make sure all services are running: docker compose up -d`);
    return null;
  }
}

// ── Console helpers ───────────────────────────────────────────────────────────

function section(title: string): void {
  console.log(`\n${"─".repeat(65)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(65));
}
function ok(msg: string):   void { console.log(`  ✅  ${msg}`); }
function warn(msg: string): void { console.log(`  ⚠️   ${msg}`); }
function info(msg: string): void { console.log(`  ℹ️   ${msg}`); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║           SportVault — Master Seed Script                   ║");
  console.log("║  135 accounts · 1,000 products · 500 delivered orders       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // ── Step 0: Primary admin (env-configured) ───────────────────────────────
  await seedPost(
    "Step 0 — AccountService: seed primary admin account (env credentials)",
    `${ACCOUNT_URL}/accounts/internal/seed-admin`
  );

  // ── Step 1: 135 dummy accounts ───────────────────────────────────────────
  const accountResult = await seedPost(
    "Step 1 — AccountService: seed 100 buyers + 25 sellers + 10 admins",
    `${ACCOUNT_URL}/accounts/internal/seed`
  );
  const buyerIds:  string[] = accountResult?.buyer_ids  ?? [];
  const sellerIds: string[] = accountResult?.seller_ids ?? [];
  const adminIds:  string[] = accountResult?.admin_ids  ?? [];
  info(`Buyers: ${buyerIds.length}  |  Sellers: ${sellerIds.length}  |  Admins: ${adminIds.length}`);

  // ── Step 2: Admin reference data ────────────────────────────────────────
  await seedPost(
    "Step 2 — AdminService: verify reference data",
    `${ADMIN_URL}/admin/internal/seed`
  );

  // ── Step 3: AuthnAuthz verification ─────────────────────────────────────
  await seedPost(
    "Step 3 — AuthnAuthzService: verify auth DB",
    `${AUTHN_URL}/auth/internal/seed`
  );

  // ── Step 4: Shopping carts ───────────────────────────────────────────────
  await seedPost(
    "Step 4 — ShoppingCartService: seed sample carts",
    `${CART_URL}/cart/internal/seed`,
    { buyerIds }
  );

  // ── Step 5: Inventory — 1,000 products across 25 sellers ─────────────────
  // Must run BEFORE orders so we can pass real product IDs to the order seed.
  const inventoryResult = await seedPost(
    "Step 5 — InventoryService: seed subcategories + 1,000 products (40/seller) + images",
    `${INVENTORY_URL}/inventory/internal/seed`,
    { sellerIds }
  );
  const productIds: string[] = inventoryResult?.product_ids ?? [];
  info(`Products seeded: ${productIds.length}`);

  // ── Step 6: 500 delivered orders across all buyers ───────────────────────
  await seedPost(
    "Step 6 — OrderService: seed 500 delivered orders (5 per buyer)",
    `${ORDER_URL}/orders/internal/seed`,
    { buyerIds, productIds }
  );

  // ── Step 7: Seller reference data ───────────────────────────────────────
  await seedPost(
    "Step 7 — SellerService: verify seller reference data",
    `${SELLER_URL}/sellers/internal/seed`
  );

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Seed complete! Check service logs for detailed output.     ║");
  console.log("║  Credentials file: resources/accounts.txt                  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

main().catch((err) => {
  console.error("\n❌  Seed script failed:", err.message);
  process.exit(1);
});
