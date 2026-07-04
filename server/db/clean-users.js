// Wipe all NON-admin users for a fresh start, keeping the predefined admin(s).
// Every users(id) foreign key in the schema is ON DELETE CASCADE, so removing a
// user automatically clears their balances, wallet addresses, wallets,
// transactions, approval requests and support messages.
//   npm run db:clean-users
import 'dotenv/config';
import { pool } from './pool.js';

async function cleanUsers() {
  const client = await pool.connect();
  try {
    // Who we keep vs. who we remove (admins stay).
    const { rows: admins } = await client.query(
      `SELECT email, role FROM users WHERE role = 'admin' ORDER BY email`
    );
    const { rows: doomed } = await client.query(
      `SELECT email, role FROM users WHERE role <> 'admin' ORDER BY email`
    );

    console.log(`Keeping ${admins.length} admin user(s):`);
    admins.forEach((u) => console.log(`  • ${u.email} (${u.role})`));

    if (doomed.length === 0) {
      console.log('No non-admin users to remove — database is already clean.');
      return;
    }

    console.log(`Removing ${doomed.length} non-admin user(s) (cascades to their data):`);
    doomed.forEach((u) => console.log(`  ✗ ${u.email} (${u.role})`));

    const { rowCount } = await client.query(`DELETE FROM users WHERE role <> 'admin'`);
    console.log(`✓ Deleted ${rowCount} user(s). Fresh slate ready.`);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanUsers().catch((err) => {
  console.error('User cleanup failed:', err);
  process.exit(1);
});
