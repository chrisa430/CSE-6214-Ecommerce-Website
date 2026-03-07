/**
 * @fileoverview Seed 20 dummy users into the account database for testing
 * @module scripts/seed-users.ts
 * @author Darrell Hobson
 * @Date 2026.03.05
 *
 * Usage:
 *   cd Sprint_3/scripts
 *   npm install
 *   npx ts-node seed-users.ts
 *
 * All dummy accounts use password: Test1234!
 * Users are spread across buyer/seller types and active/suspended/closed/open statuses.
 */
import { Client } from "pg";
import bcrypt from "bcrypt";

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = parseInt(process.env.DB_PORT || "5433");
const DB_NAME = process.env.DB_NAME || "account";
const DB_USER = process.env.DB_USER || "account_user";
const DB_PASS = process.env.DB_PASS || "account_pass";

const BCRYPT_ROUNDS = 10;
const DUMMY_PASSWORD = "Test1234!";

// ── Dummy users ───────────────────────────────────────────────────────────────

const DUMMY_USERS = [
  // Buyers — various statuses
  { email: "james.carter@demo.com",   first: "James",   last: "Carter",   type: "buyer",  status: "active",    activatedDaysAgo: 30 },
  { email: "priya.sharma@demo.com",   first: "Priya",   last: "Sharma",   type: "buyer",  status: "active",    activatedDaysAgo: 14 },
  { email: "marcus.lewis@demo.com",   first: "Marcus",  last: "Lewis",    type: "buyer",  status: "active",    activatedDaysAgo: 60 },
  { email: "sophia.chen@demo.com",    first: "Sophia",  last: "Chen",     type: "buyer",  status: "suspended", activatedDaysAgo: 45, suspendedDaysAgo: 5 },
  { email: "liam.nguyen@demo.com",    first: "Liam",    last: "Nguyen",   type: "buyer",  status: "closed",    activatedDaysAgo: 90, closedDaysAgo: 10 },
  { email: "ava.robinson@demo.com",   first: "Ava",     last: "Robinson", type: "buyer",  status: "open",      activatedDaysAgo: null },
  { email: "ethan.brown@demo.com",    first: "Ethan",   last: "Brown",    type: "buyer",  status: "active",    activatedDaysAgo: 20 },
  { email: "mia.garcia@demo.com",     first: "Mia",     last: "Garcia",   type: "buyer",  status: "open",      activatedDaysAgo: null },

  // Sellers — various statuses
  { email: "noah.thompson@demo.com",  first: "Noah",    last: "Thompson", type: "seller", status: "active",    activatedDaysAgo: 50 },
  { email: "isabella.white@demo.com", first: "Isabella",last: "White",    type: "seller", status: "active",    activatedDaysAgo: 22 },
  { email: "oliver.hall@demo.com",    first: "Oliver",  last: "Hall",     type: "seller", status: "suspended", activatedDaysAgo: 70, suspendedDaysAgo: 3 },
  { email: "emma.martin@demo.com",    first: "Emma",    last: "Martin",   type: "seller", status: "active",    activatedDaysAgo: 10 },
  { email: "lucas.anderson@demo.com", first: "Lucas",   last: "Anderson", type: "seller", status: "closed",    activatedDaysAgo: 120, closedDaysAgo: 7 },
  { email: "amelia.taylor@demo.com",  first: "Amelia",  last: "Taylor",   type: "seller", status: "open",      activatedDaysAgo: null },
  { email: "aiden.wilson@demo.com",   first: "Aiden",   last: "Wilson",   type: "seller", status: "active",    activatedDaysAgo: 35 },
  { email: "harper.jackson@demo.com", first: "Harper",  last: "Jackson",  type: "seller", status: "suspended", activatedDaysAgo: 55, suspendedDaysAgo: 12 },
  { email: "elijah.lee@demo.com",     first: "Elijah",  last: "Lee",      type: "seller", status: "active",    activatedDaysAgo: 8 },
  { email: "abigail.harris@demo.com", first: "Abigail", last: "Harris",   type: "buyer",  status: "open",      activatedDaysAgo: null },
  { email: "mason.clark@demo.com",    first: "Mason",   last: "Clark",    type: "buyer",  status: "active",    activatedDaysAgo: 18 },
  { email: "evelyn.lewis@demo.com",   first: "Evelyn",  last: "Lewis",    type: "seller", status: "closed",    activatedDaysAgo: 100, closedDaysAgo: 2 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USER, password: DB_PASS });

  console.log(`\n🔌  Connecting to ${DB_HOST}:${DB_PORT}/${DB_NAME}…`);
  await client.connect();
  console.log("✅  Connected\n");

  console.log(`🔐  Hashing password for all dummy users (${BCRYPT_ROUNDS} rounds)…`);
  const passwordHash = await bcrypt.hash(DUMMY_PASSWORD, BCRYPT_ROUNDS);
  console.log("✅  Hash ready\n");

  let inserted = 0;
  let skipped  = 0;

  for (const u of DUMMY_USERS) {
    try {
      // Skip if already exists
      const exists = await client.query("SELECT id FROM account WHERE user_id = $1", [u.email]);
      if (exists.rowCount && exists.rowCount > 0) {
        console.log(`⏭️   Skipping (exists): ${u.email}`);
        skipped++;
        continue;
      }

      // Resolve type & status
      const typeRow   = await client.query("SELECT id FROM account_type   WHERE name = $1", [u.type]);
      const statusRow = await client.query("SELECT id FROM account_status WHERE name = $1", [u.status]);

      if (!typeRow.rowCount || !statusRow.rowCount) {
        console.error(`❌  Unknown type/status for ${u.email} — skipping`);
        skipped++;
        continue;
      }

      const activatedDate  = (u as any).activatedDaysAgo != null ? daysAgo((u as any).activatedDaysAgo) : null;
      const suspendedDate  = (u as any).suspendedDaysAgo != null ? daysAgo((u as any).suspendedDaysAgo) : null;
      const closedDate     = (u as any).closedDaysAgo    != null ? daysAgo((u as any).closedDaysAgo)    : null;

      const result = await client.query(
        `INSERT INTO account
           (user_id, password_hash, first_name, last_name,
            type_id, status_id, activated_date, suspended_date, closed_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          u.email,
          passwordHash,
          u.first,
          u.last,
          typeRow.rows[0].id,
          statusRow.rows[0].id,
          activatedDate,
          suspendedDate,
          closedDate,
        ]
      );

      // Audit log
      await client.query(
        `INSERT INTO account_audit_log (actor_id, target_id, action, detail)
         VALUES ($1, $2, $3, $4)`,
        [result.rows[0].id, result.rows[0].id, "ACCOUNT_SEEDED", `Dummy user seeded: ${u.email}`]
      );

      console.log(`✅  Inserted: ${u.email.padEnd(35)} type=${u.type.padEnd(7)} status=${u.status}`);
      inserted++;
    } catch (err: any) {
      console.error(`❌  Failed for ${u.email}: ${err.message}`);
      skipped++;
    }
  }

  await client.end();

  console.log(`\n📊  Done — ${inserted} inserted, ${skipped} skipped`);
  console.log(`🔑  All dummy accounts use password: ${DUMMY_PASSWORD}\n`);
}

main().catch((err) => {
  console.error("\n❌  Seed failed:", err.message);
  process.exit(1);
});
