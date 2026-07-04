// Multi-chain address derivation via Trust Wallet Core (WASM).
//
// Trust Wallet Core ships as a WebAssembly module. `initWasm()` compiles/loads it
// ONCE and returns the API namespace (HDWallet, CoinType, AnyAddress, Mnemonic).
// We cache that promise so the (heavy) WASM init runs a single time per process.
import { initWasm } from '@trustwallet/wallet-core';

let _corePromise = null;
/** Initialize Wallet Core once and reuse the WASM namespace everywhere. */
export function getCore() {
  if (!_corePromise) _corePromise = initWasm();
  return _corePromise;
}

// Our four supported chains → Wallet Core CoinType ids. It's a function because
// `CoinType` only exists *after* the WASM module has finished initializing.
const coinMap = (core) => ({
  bitcoin:  core.CoinType.bitcoin,   // default derivation = BIP84 native SegWit  → bc1q…
  ethereum: core.CoinType.ethereum,  // BIP44 m/44'/60'  → EIP-55 checksummed 0x…
  tron:     core.CoinType.tron,      // BIP44 m/44'/195' → base58check (0x41)     → T…
  solana:   core.CoinType.solana,    // ed25519 pubkey, Base58 (path handled below)
});

// Solana: Wallet Core's DEFAULT path is m/44'/501'/0' (3 levels), which does NOT
// match Phantom / MetaMask / Trust Wallet. Those use m/44'/501'/0'/0' (4 levels),
// so we derive that path EXPLICITLY (getKey → ed25519 pubkey → address). This
// version of Wallet Core has no `Derivation.solanaSollet`, hence the explicit path.
const SOLANA_PATH = "m/44'/501'/0'/0'";
function deriveSolanaStandard(core, wallet) {
  const key = wallet.getKey(core.CoinType.solana, SOLANA_PATH);
  const pub = key.getPublicKeyEd25519();
  const anyAddr = core.AnyAddress.createWithPublicKey(pub, core.CoinType.solana);
  const address = anyAddr.description();
  // Free the WASM-held objects.
  anyAddr.delete?.(); pub.delete?.(); key.delete?.();
  return address;
}

/**
 * Derive the public receiving address for all four chains from one 12-word seed.
 * Returns { bitcoin, ethereum, tron, solana }. Throws on an invalid mnemonic.
 */
export async function deriveAddresses(mnemonic) {
  const core = await getCore();
  const { HDWallet, Mnemonic } = core;

  // Reject a bad seed up front (wordlist + checksum check).
  if (!Mnemonic.isValid(mnemonic)) throw new Error('Invalid BIP-39 mnemonic.');

  // '' = no BIP39 passphrase (the standard 12-word case).
  const wallet = HDWallet.createWithMnemonic(mnemonic, '');
  try {
    const coins = coinMap(core);
    // getAddressForCoin() applies each coin's DEFAULT path + address format.
    // For Bitcoin that default is BIP84 native SegWit (m/84'/0'/0'/0/0) → bc1q…,
    // which is what fixes the legacy/segwit mixing.
    const addresses = {
      bitcoin:  wallet.getAddressForCoin(coins.bitcoin),
      ethereum: wallet.getAddressForCoin(coins.ethereum),
      tron:     wallet.getAddressForCoin(coins.tron),
      // Standard m/44'/501'/0'/0' so it matches Phantom / MetaMask / Trust Wallet.
      solana:   deriveSolanaStandard(core, wallet),
    };

    // Hard guarantee the BTC address is Native SegWit, never legacy.
    if (!addresses.bitcoin.startsWith('bc1q')) {
      throw new Error(`Expected native SegWit BTC address, got: ${addresses.bitcoin}`);
    }
    return addresses;
  } finally {
    // HDWallet holds key material in WASM memory — free it the moment we're done.
    wallet.delete();
  }
}

/**
 * Validate an address for one specific chain BEFORE making API calls.
 * `chain` ∈ 'bitcoin' | 'ethereum' | 'tron' | 'solana'. Returns a boolean.
 */
export async function isValidAddress(chain, address) {
  const core = await getCore();
  const coin = coinMap(core)[chain];
  if (!coin) throw new Error(`Unsupported chain: ${chain}`);
  // AnyAddress.isValid runs Wallet Core's full per-coin check
  // (encoding, checksum, prefix, length) — the right gate before any RPC call.
  return core.AnyAddress.isValid(address, coin);
}
