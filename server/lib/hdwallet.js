// Permanent per-user HD wallet derivation. The 12-word BIP-39 mnemonic is the
// single source of truth; all four chain addresses are derived from it via Trust
// Wallet Core (see lib/walletCore.js), which uses each chain's STANDARD derivation
// path + address format:
//
//   BTC   m/84'/0'/0'/0/0   → native SegWit (bech32)   bc1q…
//   ETH   m/44'/60'/0'/0/0  → EIP-55                    0x…
//   TRON  m/44'/195'/0'/0/0 → base58check (0x41 prefix) T…
//   SOL   m/44'/501'/0'      → ed25519 pubkey, base58
//
// ethers is kept ONLY for (a) generating the random mnemonic and (b) the encrypted
// JSON keystore used to persist/recover the seed (the admin/user "reveal phrase"
// flow reads the mnemonic back out of it). All address math lives in walletCore.js.
//
// SECURITY: the raw key / mnemonic lives only in memory here and is NEVER logged,
// returned, or stored in plaintext — only the encrypted keystore is persisted.
import { ethers } from 'ethers';
import { deriveAddresses } from './walletCore.js';

// Derive all four chain addresses from a mnemonic, in the shape the rest of the
// app expects ({ ethAddress, tronAddress, btcAddress, solAddress }).
export async function deriveAllAddresses(mnemonic) {
  const a = await deriveAddresses(mnemonic); // { bitcoin, ethereum, tron, solana }
  return {
    ethAddress:  a.ethereum,
    tronAddress: a.tron,
    btcAddress:  a.bitcoin,
    solAddress:  a.solana,
  };
}

// NEW user: generate a fresh 12-word mnemonic, derive all four addresses, and
// return them + the ENCRYPTED keystore (which preserves the mnemonic for future
// derivation / seed reveal) + the plaintext phrase (shown to the user ONCE at signup).
export async function generateUserWallet(keystorePassword) {
  const wallet = ethers.Wallet.createRandom();              // offline, 12-word mnemonic
  const mnemonic = wallet.mnemonic.phrase;
  const addresses = await deriveAllAddresses(mnemonic);     // Trust Wallet Core
  const keystore = await wallet.encrypt(keystorePassword);  // scrypt + AES JSON (keeps the mnemonic)
  return { ...addresses, keystore, mnemonic };
}

// EXISTING user (backfill / re-derive): recover the mnemonic from the stored
// keystore and re-derive all four addresses. Deterministic — the same seed always
// yields the same addresses.
export async function deriveAddressesFromKeystore(keystore, keystorePassword) {
  const json = typeof keystore === 'string' ? keystore : JSON.stringify(keystore);
  const wallet = await ethers.Wallet.fromEncryptedJson(json, keystorePassword);
  if (!wallet.mnemonic) {
    throw new Error('Keystore has no mnemonic — cannot derive multi-chain addresses.');
  }
  return deriveAllAddresses(wallet.mnemonic.phrase);
}
