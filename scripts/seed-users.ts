/**
 * @fileoverview Seed 135 accounts into the account database for testing
 *   - 100 Buyers  (buyer001–buyer100 @sportvault.com)  password: Test1234!
 *   -  25 Sellers (seller001–seller025@sportvault.com) password: Test1234!
 *   -  10 Admins  (admin001–admin010 @sportvault.com)  password: Admin1234!
 *
 * @module scripts/seed-users.ts
 * @author Darrell Hobson
 * @Date 2026.04.03
 *
 * Usage:
 *   cd scripts
 *   npm install
 *   npx ts-node seed-users.ts
 */
import { Client } from "pg";
import bcrypt from "bcrypt";

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = parseInt(process.env.DB_PORT || "5433");
const DB_NAME = process.env.DB_NAME || "account";
const DB_USER = process.env.DB_USER || "account_user";
const DB_PASS = process.env.DB_PASS || "account_pass";

const BCRYPT_ROUNDS   = 10;
const BUYER_PASSWORD  = "Test1234!";
const ADMIN_PASSWORD  = "Admin1234!";

// ── Name pools ────────────────────────────────────────────────────────────────
// 10 × 10 = 100 unique buyer full names
const BUYER_FIRST  = ["Aaron","Brooke","Cameron","Diana","Ethan","Fiona","Gabriel","Hailey","Isaac","Jasmine"];
const BUYER_LAST   = ["Anderson","Baker","Carter","Davis","Evans","Foster","Garcia","Harris","Irving","Johnson"];

// 5 × 5 = 25 unique seller full names
const SELLER_FIRST = ["Kyle","Lauren","Marcus","Natalie","Oscar"];
const SELLER_LAST  = ["Phillips","Quinn","Roberts","Scott","Turner"];

// 10 fixed admin identities
const ADMIN_NAMES = [
  { first: "Alex",  last: "Morgan"   },
  { first: "Beth",  last: "Hamilton" },
  { first: "Carl",  last: "Stevens"  },
  { first: "Diana", last: "Walsh"    },
  { first: "Eric",  last: "Chambers" },
  { first: "Faye",  last: "Thornton" },
  { first: "Grant", last: "Wheeler"  },
  { first: "Helen", last: "Burke"    },
  { first: "Ian",   last: "Caldwell" },
  { first: "Julia", last: "Reeves"   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

interface AccountDef {
  email: string;
  first: string;
  last:  string;
  type:  string;
  status: string;
  activatedDaysAgo: number | null;
  suspendedDaysAgo?: number;
  closedDaysAgo?: number;
  password: string;
}

// ── Generate account arrays ───────────────────────────────────────────────────

/** 100 buyers — buyers 91–97 suspended, 98–100 closed, rest active */
const BUYERS: AccountDef[] = Array.from({ length: 100 }, (_, i) => {
  const n = i + 1;
  const firstIdx = Math.floor(i / 10);
  const lastIdx  = i % 10;
  let status = "active";
  let activatedDaysAgo: number | null = ((n * 7) % 365) + 1;
  let suspendedDaysAgo: number | undefined;
  let closedDaysAgo:    number | undefined;
  if (n >= 91 && n <= 97) {
    status = "suspended";
    activatedDaysAgo = 90 + (n % 7) * 10;
    suspendedDaysAgo = (n % 30) + 1;
  } else if (n >= 98) {
    status = "closed";
    activatedDaysAgo = 180 + n;
    closedDaysAgo    = (n % 20) + 5;
  }
  return {
    email: `buyer${pad(n, 3)}@sportvault.com`,
    first: BUYER_FIRST[firstIdx],
    last:  BUYER_LAST[lastIdx],
    type: "buyer", status, activatedDaysAgo,
    suspendedDaysAgo, closedDaysAgo,
    password: BUYER_PASSWORD,
  };
});

/** 25 sellers — sellers 21–23 suspended, 24–25 closed, rest active */
const SELLERS: AccountDef[] = Array.from({ length: 25 }, (_, i) => {
  const n = i + 1;
  const firstIdx = Math.floor(i / 5);
  const lastIdx  = i % 5;
  let status = "active";
  let activatedDaysAgo: number | null = ((n * 11) % 300) + 14;
  let suspendedDaysAgo: number | undefined;
  let closedDaysAgo:    number | undefined;
  if (n >= 21 && n <= 23) {
    status = "suspended";
    activatedDaysAgo = 120 + n * 5;
    suspendedDaysAgo = (n % 15) + 3;
  } else if (n >= 24) {
    status = "closed";
    activatedDaysAgo = 200 + n * 3;
    closedDaysAgo    = (n % 10) + 7;
  }
  return {
    email: `seller${pad(n, 3)}@sportvault.com`,
    first: SELLER_FIRST[firstIdx],
    last:  SELLER_LAST[lastIdx],
    type: "seller", status, activatedDaysAgo,
    suspendedDaysAgo, closedDaysAgo,
    password: BUYER_PASSWORD,
  };
});

/** 10 admins — all active */
const ADMINS: AccountDef[] = ADMIN_NAMES.map((nm, i) => ({
  email: `admin${pad(i + 1, 3)}@sportvault.com`,
  first: nm.first,
  last:  nm.last,
  type: "admin",
  status: "active",
  activatedDaysAgo: (i + 1) * 15,
  password: ADMIN_PASSWORD,
}));

const ALL_ACCOUNTS: AccountDef[] = [...BUYERS, ...SELLERS, ...ADMINS];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({
    host: DB_HOST, port: DB_PORT, database: DB_NAME,
    user: DB_USER, password: DB_PASS,
  });

  console.log(`\n🔌  Connecting to ${DB_HOST}:${DB_PORT}/${DB_NAME}…`);
  await client.connect();
  console.log("✅  Connected\n");

  console.log("🔐  Pre-hashing passwords (bcrypt ×2 — buyer/seller and admin)…");
  const buyerHash = await bcrypt.hash(BUYER_PASSWORD, BCRYPT_ROUNDS);
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
  console.log("✅  Hashes ready\n");

  let inserted = 0;
  let skipped  = 0;

  const counters: Record<string, number> = { buyer: 0, seller: 0, admin: 0 };

  for (const u of ALL_ACCOUNTS) {
    try {
      const exists = await client.query(
        "SELECT id FROM account WHERE user_id = $1", [u.email]
      );
      if (exists.rowCount && exists.rowCount > 0) {
        skipped++;
        continue;
      }

      const typeRow   = await client.query(
        "SELECT id FROM account_type   WHERE name = $1", [u.type]
      );
      const statusRow = await client.query(
        "SELECT id FROM account_status WHERE name = $1", [u.status]
      );
      if (!typeRow.rowCount || !statusRow.rowCount) {
        console.error(`❌  Unknown type/status for ${u.email} — skipping`);
        skipped++;
        continue;
      }

      const hash         = u.type === "admin" ? adminHash : buyerHash;
      const activatedDate = u.activatedDaysAgo  != null ? daysAgo(u.activatedDaysAgo)  : null;
      const suspendedDate = u.suspendedDaysAgo  != null ? daysAgo(u.suspendedDaysAgo)  : null;
      const closedDate    = u.closedDaysAgo     != null ? daysAgo(u.closedDaysAgo)     : null;

      const result = await client.query(
        `INSERT INTO account
           (user_id, password_hash, first_name, last_name,
            type_id, status_id, activated_date, suspended_date, closed_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [u.email, hash, u.first, u.last,
         typeRow.rows[0].id, statusRow.rows[0].id,
         activatedDate, suspendedDate, closedDate]
      );

      await client.query(
        `INSERT INTO account_audit_log (actor_id, target_id, action, detail)
         VALUES ($1,$2,$3,$4)`,
        [result.rows[0].id, result.rows[0].id, "ACCOUNT_SEEDED",
         `Seeded ${u.type}: ${u.email}`]
      );

      console.log(`✅  ${u.email.padEnd(38)} type=${u.type.padEnd(7)} status=${u.status}`);
      inserted++;
      counters[u.type]++;
    } catch (err: any) {
      console.error(`❌  Failed for ${u.email}: ${err.message}`);
      skipped++;
    }
  }

  await client.end();

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log(`║  Seed complete: ${inserted} inserted, ${skipped} skipped`.padEnd(61) + "║");
  console.log(`║    Buyers  : ${counters.buyer}`.padEnd(61)  + "║");
  console.log(`║    Sellers : ${counters.seller}`.padEnd(61) + "║");
  console.log(`║    Admins  : ${counters.admin}`.padEnd(61)  + "║");
  console.log("╠═══════════════════════════════════════════════════════════╣");
  console.log(`║  Buyer/Seller password : ${BUYER_PASSWORD}`.padEnd(61)  + "║");
  console.log(`║  Admin password        : ${ADMIN_PASSWORD}`.padEnd(61) + "║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");
}

main().catch((err) => {
  console.error("\n❌  Seed failed:", err.message);
  process.exit(1);
});
