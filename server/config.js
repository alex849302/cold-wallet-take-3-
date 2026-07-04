// Central, env-derived runtime config.
import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  // Password used to encrypt generated private keys at rest (ethers keystore).
  walletKeystorePassword: process.env.WALLET_KEYSTORE_PASSWORD,
  // App-level AES-256-GCM secret for encrypting sensitive fields (e.g. the
  // keystore) before they hit the database. Read strictly from the env.
  encryptionSecret: process.env.ENCRYPTION_SECRET,

  // Public base URL of the frontend — used to build links in outgoing emails
  // (e.g. the password-reset link). Dev default points at the Vite dev server.
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',

  // SMTP (transactional email, e.g. password reset). For Gmail use an App
  // Password (not your normal password) with host smtp.gmail.com, port 587.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    // Friendly From shown to recipients; falls back to the auth user.
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  },
  // Destination for admin operational alerts (new support messages, withdrawal
  // requests, etc.). Optional — if unset, admin email alerts are skipped.
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL || '',
  // Blockchain RPC (read-only). If RPC_URL is empty we fall back to ethers'
  // community default for RPC_NETWORK (rate-limited; fine for a quick check).
  rpcUrl: process.env.RPC_URL || '',
  // Ethereum network for the read-only provider. 'mainnet' → chainId 1 (LIVE).
  rpcNetwork: process.env.RPC_NETWORK || 'mainnet',

  // --- Other chain endpoints (read-only) ---------------------------------------
  // Each chain has a different integration model; these are the hosts each
  // service in lib/cryptoService.js talks to. All are overridable via .env.
  chains: {
    // Solana Mainnet-Beta — @solana/web3.js JSON-RPC.
    solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    // Bitcoin Mainnet — mempool.space REST API.
    bitcoinApiUrl: process.env.BITCOIN_API_URL || 'https://mempool.space/api',
    // TRON Mainnet — TronWeb fullHost (TronGrid).
    tronRpcUrl: process.env.TRON_RPC_URL || 'https://api.trongrid.io',
    // TronGrid free tier rate-limits hard (HTTP 429). A free API key from
    // https://www.trongrid.io raises the limit; sent as the TRON-PRO-API-KEY
    // header. Without it, TRON/USDT-TRC20 reads will intermittently 429.
    tronProApiKey: process.env.TRON_PRO_API_KEY || '',
    // TRC-20 USDT contract on TRON MAINNET — official Tether (6 decimals).
    tronUsdtContract: process.env.TRON_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    // ERC-20 USDT contract on Ethereum MAINNET — official Tether (6 decimals).
    ethUsdtContract: process.env.ETH_USDT_CONTRACT || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    // A valid base58 address TronWeb uses as the default "from" for read-only
    // constant calls (balanceOf doesn't depend on it). TRON black-hole address.
    tronDefaultOwner: process.env.TRON_DEFAULT_OWNER || 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
  },
};

// ── Secret validation ────────────────────────────────────────────────────────
// Sensitive secrets are read ONLY from process.env (no hardcoded fallbacks). They
// are always required; in production we additionally reject the dev placeholders
// and enforce a minimum length so a weak/placeholder value can never ship.
const isProduction = config.nodeEnv === 'production';

// Known dev placeholders that must never reach production.
const DEV_PLACEHOLDERS = new Set([
  'dev_only_change_me_in_production',
  'dev_only_keystore_secret_change_me',
  'dev_only_encryption_secret_change_me',
]);

function requireSecret(name, value, minLength = 32) {
  if (!value) {
    throw new Error(`${name} is required — set it in the server environment.`);
  }
  if (isProduction) {
    if (DEV_PLACEHOLDERS.has(value)) {
      throw new Error(
        `${name} is still set to a dev placeholder. Generate a strong value ` +
          '(`npm run gen:secrets`) and inject it via the server environment.'
      );
    }
    if (value.length < minLength) {
      throw new Error(`${name} is too weak for production — use at least ${minLength} characters.`);
    }
  }
}

requireSecret('JWT_SECRET', config.jwt.secret);
// NOTE: WALLET_KEYSTORE_PASSWORD decrypts every user keystore — set it ONCE for a
// given database and never rotate it while wallets exist, or keys become unreadable.
requireSecret('WALLET_KEYSTORE_PASSWORD', config.walletKeystorePassword);
// NOTE: ENCRYPTION_SECRET unwraps every app-encrypted field (e.g. keystores) — set
// it ONCE per database and never rotate it while encrypted data exists.
requireSecret('ENCRYPTION_SECRET', config.encryptionSecret);
