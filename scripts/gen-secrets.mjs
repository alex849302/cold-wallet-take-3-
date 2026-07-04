// Generate strong, production-grade secrets for CoreCold using Node's crypto.
//   npm run gen:secrets
//
// base64url output is safe to paste into .env files, shells, PM2 configs and
// secrets managers (no quoting needed — only A-Z a-z 0-9 - _).
// 48 random bytes → 64-char string (~384 bits of entropy).
import crypto from 'node:crypto';

const gen = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');

console.log('# ── CoreCold production secrets ─────────────────────────────────');
console.log('# Inject these via the SERVER environment / a secrets manager.');
console.log('# Do NOT commit them or leave them in a file inside the repo.\n');
console.log(`JWT_SECRET=${gen(48)}`);
console.log(`WALLET_KEYSTORE_PASSWORD=${gen(48)}`);
console.log(`ENCRYPTION_SECRET=${gen(48)}`);
console.log('\n# ⚠ WALLET_KEYSTORE_PASSWORD and ENCRYPTION_SECRET each unlock data at rest.');
console.log('#   Set them ONCE per database and NEVER rotate while wallets/encrypted data');
console.log('#   exist, or that data becomes permanently unreadable.');
