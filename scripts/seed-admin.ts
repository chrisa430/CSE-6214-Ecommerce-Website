/**
 * @fileoverview Seed script — inserts an admin account into the account database
 * @module scripts/seed-admin.ts
 * @author Darrell Hobson
 * @Date 2026.03.05
 *
 * Usage:
 *   cd Sprint_3/scripts
 *   npm install
 *   npx ts-node seed-admin.ts
 *
 * Override defaults with environment variables:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=Admin123! npx ts-node seed-admin.ts
 */
import { Client } from "pg";
import bcrypt from "bcrypt";

// ── Config ────────────────────────────────────────────────────────────────────

const DB_HOST     = process.env.DB_HOST     || "localhost";
const DB_PORT     = parseInt(process.env.DB_PORT || "5433");
const DB_NAME     = process.env.DB_NAME     || "account";
const DB_USER     = process.env.DB_USER     || "account_user";
const DB_PASS     = process.env.DB_PASS     || "account_pass";

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || "admin@corp.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "He!!0World";
const ADMIN_FIRST    = process.env.ADMIN_FIRST    || "Admin";
const ADMIN_LAST     = process.env.ADMIN_LAST     || "User";

const BCRYPT_ROUNDS = 12;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({
    host:     DB_HOST,
    port:     DB_PORT,
    database: DB_NAME,
    user:     DB_USER,
    password: DB_PASS,
  });

  console.log(`\n🔌  Connecting to ${DB_HOST}:${DB_PORT}/${DB_NAME}…`);
  await client.connect();
  console.log("✅  Connected\n");

  try {
    // ── Check if email already exists ─────────────────────────────────────
    const existing = await client.query(
      "SELECT id FROM account WHERE user_id = $1",
      [ADMIN_EMAIL.toLowerCase()]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`⚠️  Account already exists for ${ADMIN_EMAIL} — no changes made.\n`);
      return;
    }

    // ── Resolve type_id for 'admin' ───────────────────────────────────────
    const typeRow = await client.query(
      "SELECT id FROM account_type WHERE name = 'admin'"
    );
    if (!typeRow.rowCount || typeRow.rowCount === 0) {
      throw new Error("account_type 'admin' not found — has init.sql been run?");
    }
    const typeId = typeRow.rows[0].id as string;

    // ── Resolve status_id for 'active' ────────────────────────────────────
    const statusRow = await client.query(
      "SELECT id FROM account_status WHERE name = 'active'"
    );
    if (!statusRow.rowCount || statusRow.rowCount === 0) {
      throw new Error("account_status 'active' not found — has init.sql been run?");
    }
    const statusId = statusRow.rows[0].id as string;

    // ── Hash password ─────────────────────────────────────────────────────
    console.log("🔐  Hashing password…");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

    // ── Insert admin account ──────────────────────────────────────────────
    const result = await client.query(
      `INSERT INTO account
         (user_id, password_hash, first_name, last_name, type_id, status_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, first_name, last_name, created_at`,
      [
        ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        ADMIN_FIRST,
        ADMIN_LAST,
        typeId,
        statusId,
      ]
    );

    const acct = result.rows[0];

    // ── Audit log ─────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO account_audit_log (actor_id, target_id, action, detail)
       VALUES ($1, $2, $3, $4)`,
      [acct.id, acct.id, "ACCOUNT_SEEDED", `Admin account seeded for ${ADMIN_EMAIL}`]
    );

    console.log("✅  Admin account created successfully!\n");
    console.log("┌─────────────────────────────────────────────────┐");
    console.log(`│  ID         : ${acct.id}`);
    console.log(`│  Email      : ${acct.user_id}`);
    console.log(`│  Name       : ${acct.first_name} ${acct.last_name}`);
    console.log(`│  Password   : ${ADMIN_PASSWORD}`);
    console.log(`│  Created at : ${acct.created_at}`);
    console.log("└─────────────────────────────────────────────────┘\n");
    console.log("👉  You can now log in at http://localhost:5173/login\n");

  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\n❌  Seed failed:", err.message);
  process.exit(1);
});
