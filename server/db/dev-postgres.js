// Local dev PostgreSQL — a REAL Postgres server, no Docker required.
// Uses `embedded-postgres` to download + run an actual Postgres binary, keyed
// to the SAME env vars the app uses. Dev convenience only; in production you
// point those vars at your host's Postgres.
//   npm run db:dev      # starts and STAYS running — keep this terminal open
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', '.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  persistent: true,
  // Force UTF8 (OS default on Windows is WIN1252, which can't store characters
  // like the swap arrow 'BTC→ETH').
  initdbFlags: ['--encoding=UTF8', '--lc-collate=C', '--lc-ctype=C'],
});

async function main() {
  const firstRun = !fs.existsSync(DATA_DIR);
  if (firstRun) {
    console.log('Initialising a fresh Postgres cluster in .pgdata …');
    await pg.initialise();
  }
  await pg.start();
  console.log(`Postgres up on localhost:${process.env.DB_PORT} (user ${process.env.DB_USER}).`);

  try {
    await pg.createDatabase(process.env.DB_NAME);
    console.log(`Created database "${process.env.DB_NAME}".`);
  } catch (err) {
    if (/already exists/i.test(err.message)) {
      console.log(`Database "${process.env.DB_NAME}" already exists.`);
    } else {
      throw err;
    }
  }

  console.log('Ready. Leave this running; open another terminal for migrate/seed/server.');

  const shutdown = async () => {
    console.log('\nStopping Postgres …');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start dev Postgres:', err);
  process.exit(1);
});
