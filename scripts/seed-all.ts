/**
 * @fileoverview SportVault master seed script — calls all service seed APIs
 * @module scripts/seed-all.ts
 * @author Darrell Hobson
 * @Date 2026.03.07
 *
 * Execution order:
 *   0. AccountService   — seed initial admin account (Darrell.Hobson@gmail.com)
 *   1. AccountService   — seed 20 dummy accounts (10 buyers, 10 sellers)
 *   2. AdminService     — verify admin reference data
 *   3. AuthnAuthzService — verify auth DB
 *   4. ShoppingCartService — seed sample carts
 *   5. OrderService     — seed sample orders
 *   6. SellerService    — verify seller reference data
 *   7. InventoryService — seed subcategories, 50 products, product images
 *                         (buyer IDs from step 1 are passed here)
 *
 * Usage:
 *   cd scripts && npm install && npx ts-node seed-all.ts
 *
 * Environment overrides (all default to local Docker ports):
 *   ACCOUNT_URL   http://localhost:3002
 *   ADMIN_URL     http://localhost:3003
 *   AUTHN_URL     http://localhost:3001
 *   CART_URL      http://localhost:3004
 *   ORDER_URL     http://localhost:3005
 *   SELLER_URL    http://localhost:3006
 *   INVENTORY_URL http://localhost:3007
 *   INTERNAL_SECRET internal-secret
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
    warn(`  Make sure services are running: npm run dev`);
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
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // 0. Admin account — must come first; admin approvals depend on this account
  await seedPost(
    "Step 0 — AccountService: seed initial admin account",
    `${ACCOUNT_URL}/accounts/internal/seed-admin`
  );

  // 1. Seed dummy buyer/seller accounts — capture BOTH buyer and seller IDs
  const accountResult = await seedPost(
    "Step 1 — AccountService: seed 20 dummy accounts",
    `${ACCOUNT_URL}/accounts/internal/seed`
  );
  const buyerIds:  string[] = accountResult?.buyer_ids  ?? [];
  const sellerIds: string[] = accountResult?.seller_ids ?? [];
  info(`Buyer IDs: ${buyerIds.length}  |  Seller IDs: ${sellerIds.length}`);

  // 2. Admin service — verify reference data
  await seedPost(
    "Step 3 — AdminService: verify reference data",
    `${ADMIN_URL}/admin/internal/seed`
  );

  // 3. AuthnAuthz — verify DB
  await seedPost(
    "Step 4 — AuthnAuthzService: verify auth DB",
    `${AUTHN_URL}/auth/internal/seed`
  );

  // 4. ShoppingCart
// Step 5 — add third argument:
  await seedPost("Step 5 — ShoppingCartService: seed sample carts",
      `${CART_URL}/cart/internal/seed`, { buyerIds });

// Step 6 — add third argument:
  await seedPost("Step 6 — OrderService: seed sample orders",
      `${ORDER_URL}/orders/internal/seed`, { buyerIds });
  // 6. Seller service
  await seedPost(
    "Step 7 — SellerService: verify seller reference data",
    `${SELLER_URL}/sellers/internal/seed`
  );

  // 7. Inventory — pass seller IDs so products are listed under real seller accounts
  await seedPost(
    "Step 8 — InventoryService: seed subcategories + 50 products + images",
    `${INVENTORY_URL}/inventory/internal/seed`,
    { sellerIds }
  );

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Seed complete! Check service logs for detailed output.     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

main().catch((err) => {
  console.error("\n❌  Seed script failed:", err.message);
  process.exit(1);
});
