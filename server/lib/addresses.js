// Per-asset wallet address generation (mirrors the frontend shapes):
//   BTC  = '1' + 33 base58            (34 chars)
//   SOL  = base58                     (43–44 chars)
//   ETH/USDT = '0x' + 40 hex          (42 chars)
import crypto from 'node:crypto';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const HEX = '0123456789abcdef';

function randString(charset, len) {
  let out = '';
  for (let i = 0; i < len; i++) out += charset[crypto.randomInt(charset.length)];
  return out;
}

function makeAddress(assetId) {
  switch (assetId) {
    case 'btc': return '1' + randString(B58, 33);
    case 'sol': return randString(B58, 43 + crypto.randomInt(2));
    case 'eth':
    case 'usdt':
    default:    return '0x' + randString(HEX, 40);
  }
}

// One unique address per asset. `used` guards against collisions within a batch;
// the DB UNIQUE constraint is the ultimate guard.
export function generateUniqueAddresses(used = new Set()) {
  const addresses = {};
  for (const assetId of ['btc', 'eth', 'sol', 'usdt']) {
    let addr;
    do { addr = makeAddress(assetId); } while (used.has(addr));
    used.add(addr);
    addresses[assetId] = addr;
  }
  return addresses;
}

export function randomTxHash() {
  return '0x' + randString(HEX, 64);
}
