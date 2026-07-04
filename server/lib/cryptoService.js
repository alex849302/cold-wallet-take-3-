// Multi-chain balance service.
//
// Each network has a DIFFERENT integration model — this module keeps one
// dedicated, independently-testable function per chain, plus an aggregator that
// fans them out in parallel:
//
//   ETH / Mainnet        → ethers.js          (reuses lib/provider.js)
//   SOL / Mainnet        → @solana/web3.js     (JSON-RPC Connection)
//   BTC / Mainnet        → mempool.space REST  (plain fetch — no BTC libs)
//   TRX / TRON Mainnet   → TronWeb             (native getBalance)
//   USDT-TRC20 / Mainnet → TronWeb             (TRC-20 balanceOf on TRON address)
//   USDT-ERC20 / Mainnet → ethers.js           (ERC-20 balanceOf on ETH address)
//
// Design: the per-chain functions THROW on failure (clean for testing one by
// one). The aggregator wraps each in `settle()` so one dead chain never sinks
// the whole portfolio response.
import { ethers } from 'ethers';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TronWeb } from 'tronweb';
import { config } from '../config.js';
import { getOnchainBalance, provider } from './provider.js';
import { getUserAddresses } from '../repositories/wallets.js';

const TIMEOUT_MS = 10_000;

// Minimal ERC-20 read ABI (USDT on Ethereum Mainnet).
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// Race any promise against a timeout so a throttled/dead endpoint can't hang.
function withTimeout(promise, label, ms = TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

/* ── Lazy singletons ────────────────────────────────────────────────────────
   Constructed once, reused across calls. Creating them opens no socket. */
let _sol;
function solana() {
  return (_sol ??= new Connection(config.chains.solanaRpcUrl, 'confirmed'));
}

let _tron;
function tron() {
  if (!_tron) {
    // A TronGrid API key (TRON_PRO_API_KEY) lifts the free-tier rate limit that
    // otherwise returns HTTP 429 on TRX / USDT-TRC20 balance reads.
    const headers = config.chains.tronProApiKey
      ? { 'TRON-PRO-API-KEY': config.chains.tronProApiKey }
      : undefined;
    _tron = new TronWeb({ fullHost: config.chains.tronRpcUrl, headers });
    // Constant (read-only) calls need a default "from"; balanceOf ignores it.
    _tron.setAddress(config.chains.tronDefaultOwner);
  }
  return _tron;
}

/* ── ETH / Mainnet (ethers.js) ───────────────────────────────────────────────
   Reuses the existing provider so there's one source of truth for the ETH RPC. */
export async function getEthereumBalance(ethAddress) {
  const d = await getOnchainBalance(ethAddress); // already has its own 10s timeout
  return {
    asset: 'eth',
    chain: 'ethereum',
    network: d.network,
    address: d.address,
    balance: d.balanceEth,   // human-readable
    raw: d.balanceWei,       // base units (wei)
    unit: 'ETH',
  };
}

/* ── SOL / Mainnet-Beta (@solana/web3.js) ────────────────────────────────────
   Fetch lamports for the pubkey, convert to SOL. */
export async function getSolanaBalance(solAddress) {
  const pubkey = new PublicKey(solAddress); // throws on malformed base58
  const lamports = await withTimeout(solana().getBalance(pubkey), 'Solana getBalance');
  return {
    asset: 'sol',
    chain: 'solana',
    network: 'mainnet',
    address: solAddress,
    balance: (lamports / LAMPORTS_PER_SOL).toString(),
    raw: String(lamports),   // base units (lamports)
    unit: 'SOL',
  };
}

/* ── BTC / Mainnet (mempool.space REST — no BTC libraries) ───────────────────
   GET /address/:addr → chain_stats { funded_txo_sum, spent_txo_sum } (sats).
   Confirmed balance = funded − spent. */
export async function getBitcoinBalance(btcAddress) {
  const url = `${config.chains.bitcoinApiUrl}/address/${btcAddress}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`mempool.space ${res.status} for ${btcAddress} (is it a valid mainnet address?)`);
  }
  const d = await res.json();
  const sats = (d.chain_stats?.funded_txo_sum ?? 0) - (d.chain_stats?.spent_txo_sum ?? 0);
  return {
    asset: 'btc',
    chain: 'bitcoin',
    network: 'mainnet',
    address: btcAddress,
    balance: (sats / 1e8).toFixed(8),
    raw: String(sats),       // base units (satoshis)
    unit: 'BTC',
  };
}

/* ── TRX / TRON Mainnet (TronWeb native) ─────────────────────────────────────
   Native TRX balance. trx.getBalance returns sun (1 TRX = 1e6 sun). */
export async function getTronBalance(tronAddress) {
  if (!tron().isAddress(tronAddress)) {
    throw new Error(`Invalid TRON address: ${tronAddress}`);
  }
  const sun = await withTimeout(tron().trx.getBalance(tronAddress), 'TRON getBalance');
  return {
    asset: 'tron',
    chain: 'tron',
    network: 'mainnet',
    address: tronAddress,
    balance: (Number(sun) / 1e6).toString(),
    raw: String(sun),        // base units (sun)
    unit: 'TRX',
  };
}

/* ── USDT-TRC20 / TRON Mainnet (TronWeb) ─────────────────────────────────────
   TRC-20 USDT on the user's TRON address. balanceOf; USDT has 6 decimals. */
export async function getTRC20USDTBalance(tronAddress) {
  if (!tron().isAddress(tronAddress)) {
    throw new Error(`Invalid TRON address: ${tronAddress}`);
  }
  const contract = await withTimeout(
    tron().contract().at(config.chains.tronUsdtContract),
    'TronWeb contract().at'
  );
  const raw = await withTimeout(contract.balanceOf(tronAddress).call(), 'TRC-20 balanceOf');
  const rawStr = raw.toString();
  return {
    asset: 'usdt_trc20',
    chain: 'tron',
    network: 'mainnet',
    address: tronAddress,
    balance: ethers.formatUnits(rawStr, 6), // USDT TRC-20 = 6 decimals
    raw: rawStr,
    unit: 'USDT',
    contract: config.chains.tronUsdtContract,
  };
}

/* ── USDT-ERC20 / Ethereum Mainnet (ethers.js) ───────────────────────────────
   ERC-20 USDT on the user's ETH address. Reads balanceOf + decimals from the
   configured mainnet USDT contract via the shared read-only provider. */
export async function getERC20USDTBalance(ethAddress) {
  if (!ethers.isAddress(ethAddress)) {
    throw new Error(`Invalid Ethereum address: ${ethAddress}`);
  }
  const contract = new ethers.Contract(config.chains.ethUsdtContract, ERC20_ABI, provider);
  const [raw, decimals] = await withTimeout(
    Promise.all([
      contract.balanceOf(ethAddress),
      contract.decimals().catch(() => 6), // default to 6 if the token omits decimals()
    ]),
    'ERC-20 balanceOf',
  );
  const rawStr = raw.toString();
  return {
    asset: 'usdt_erc20',
    chain: 'ethereum',
    network: 'mainnet',
    address: ethAddress,
    balance: ethers.formatUnits(rawStr, decimals),
    raw: rawStr,
    unit: 'USDT',
    contract: config.chains.ethUsdtContract,
  };
}

/* ── Aggregator ──────────────────────────────────────────────────────────────
   Loads the user's permanent addresses, fetches every chain IN PARALLEL, and
   returns one clean payload. Per-chain failures become { ok:false, error } so a
   single dead RPC doesn't fail the whole request. */
async function settle(asset, address, fn) {
  if (!address) return { asset, ok: false, error: 'no address on file' };
  try {
    return { ...(await fn(address)), ok: true };
  } catch (err) {
    return { asset, address, ok: false, error: err.shortMessage || err.message };
  }
}

export async function updateAllPortfolioBalances(userId) {
  const addr = await getUserAddresses(userId); // { btc, eth, sol, tron }

  const [btc, eth, sol, tron, usdt_trc20, usdt_erc20] = await Promise.all([
    settle('btc',        addr.btc,  getBitcoinBalance),
    settle('eth',        addr.eth,  getEthereumBalance),
    settle('sol',        addr.sol,  getSolanaBalance),
    settle('tron',       addr.tron, getTronBalance),         // native TRX
    // USDT-TRC20 lives on the TRON address; USDT-ERC20 on the ETH address.
    settle('usdt_trc20', addr.tron, getTRC20USDTBalance),
    settle('usdt_erc20', addr.eth,  getERC20USDTBalance),
  ]);

  return {
    userId,
    fetchedAt: new Date().toISOString(),
    balances: { btc, eth, sol, tron, usdt_trc20, usdt_erc20 },
  };
}

/* ── Address → chain detection ────────────────────────────────────────────────
   Detects the network purely from the address format, validating per chain so a
   look-alike string can't be misrouted:
     • '0x…' (40 hex)      → ethereum   (ethers EIP-55 check)
     • 'T…'  (base58check) → tron       (TronWeb checksum)
     • 32-byte base58      → solana     (ed25519 pubkey; BTC/TRON decode to 25)
     • '1'/'3'/'bc1…'      → bitcoin    (mainnet P2PKH / P2SH / bech32)            */
export function detectChain(address) {
  const a = String(address || '').trim();
  if (!a) return null;
  if (a.startsWith('0x') && ethers.isAddress(a)) return 'ethereum';
  if (a[0] === 'T' && tron().isAddress(a)) return 'tron';
  try { new PublicKey(a); return 'solana'; } catch { /* not a 32-byte key */ }
  if (/^bc1[0-9ac-hj-np-z]{8,87}$/.test(a) || /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) return 'bitcoin';
  return null;
}

// Wrap a per-chain fetch so one dead endpoint becomes { ok:false, error } rather
// than throwing. (Module-level `settle` above has a different signature.)
async function attempt(fn) {
  try { return { ...(await fn()), ok: true }; }
  catch (err) { return { ok: false, error: err.shortMessage || err.message }; }
}

// Normalize a settled result into a uniform balance row carrying its decimals.
function balanceRow(settled, { asset, unit, decimals }) {
  if (!settled.ok) return { asset, unit, decimals, ok: false, error: settled.error };
  return {
    asset:   settled.asset ?? asset,
    unit:    settled.unit ?? unit,
    decimals,                      // 18 ETH · 6 USDT · 8 BTC · 9 SOL · 6 TRX
    balance: settled.balance,      // human-readable, already scaled by `decimals`
    raw:     settled.raw,          // base units (wei / sats / lamports / sun)
    contract: settled.contract,    // set for USDT (TRC-20 / ERC-20)
    ok: true,
  };
}

/* Admin balance checker: detect an address's chain, route to the matching
   endpoint, and return its native balance — plus USDT on EVM/TRON — each
   formatted with the correct decimals. Endpoint routing per chain:
     ethereum → RPC_URL · tron → TRON_RPC_URL · bitcoin → BITCOIN_API_URL ·
     solana → SOLANA_RPC_URL  (all read from .env via lib/config + the helpers). */
export async function getAddressBalances(address) {
  const chain = detectChain(address);
  if (!chain) {
    const err = new Error('Unrecognized address format. Enter a Bitcoin, Ethereum, Solana or TRON address.');
    err.code = 'BAD_ADDRESS';
    throw err;
  }

  let network = 'mainnet';
  let balances;

  if (chain === 'ethereum') {                       // → RPC_URL
    const [eth, usdt] = await Promise.all([
      attempt(() => getEthereumBalance(address)),
      attempt(() => getERC20USDTBalance(address)),
    ]);
    if (eth.ok && eth.network) network = eth.network;
    balances = [
      balanceRow(eth,  { asset: 'eth',  unit: 'ETH',  decimals: 18 }),
      balanceRow(usdt, { asset: 'usdt', unit: 'USDT', decimals: 6 }),
    ];
  } else if (chain === 'tron') {                    // → TRON_RPC_URL
    const [trx, usdt] = await Promise.all([
      attempt(() => getTronBalance(address)),
      attempt(() => getTRC20USDTBalance(address)),
    ]);
    balances = [
      balanceRow(trx,  { asset: 'tron', unit: 'TRX',  decimals: 6 }),
      balanceRow(usdt, { asset: 'usdt', unit: 'USDT', decimals: 6 }),
    ];
  } else if (chain === 'bitcoin') {                 // → BITCOIN_API_URL
    const btc = await attempt(() => getBitcoinBalance(address));
    balances = [balanceRow(btc, { asset: 'btc', unit: 'BTC', decimals: 8 })];
  } else {                                          // solana → SOLANA_RPC_URL
    const sol = await attempt(() => getSolanaBalance(address));
    balances = [balanceRow(sol, { asset: 'sol', unit: 'SOL', decimals: 9 })];
  }

  return { address, chain, network, balances };
}
