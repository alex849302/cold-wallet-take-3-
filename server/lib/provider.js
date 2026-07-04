// Read-only blockchain provider, initialized from environment config.
//
//   • RPC_URL set      → ethers.JsonRpcProvider(RPC_URL)  (your Infura/Alchemy/public node)
//   • RPC_URL empty    → ethers.getDefaultProvider(RPC_NETWORK)  (community keys, rate-limited)
//
// Providers are lazy — constructing one does NOT open a connection, so a bad/empty
// config never crashes startup; the actual check happens in logChainConnection().
import { ethers } from 'ethers';
import { config } from '../config.js';

export function makeProvider() {
  // Pin the expected network (e.g. "mainnet" → chainId 1) so the provider
  // validates the RPC's chain and skips a per-call eth_chainId round-trip.
  if (config.rpcUrl) return new ethers.JsonRpcProvider(config.rpcUrl, config.rpcNetwork);
  return ethers.getDefaultProvider(config.rpcNetwork);
}

export const provider = makeProvider();

// Hide any API key in the URL before logging it.
function redact(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname.length > 1 ? '/…' : ''}`;
  } catch {
    return 'custom-endpoint';
  }
}

// Race any RPC promise against a timeout so a throttled/unreachable node can't hang.
function withTimeout(promise, ms = 10_000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms)),
  ]);
}

// Fetch the REAL on-chain balance for an address from the configured network.
// Returns balance in both wei (string) and ETH, plus the network + latest block.
// Throws { code: 'BAD_ADDRESS' } for an invalid address; other errors bubble up
// (the route maps them to 503 — the node was unreachable).
export async function getOnchainBalance(address) {
  if (!ethers.isAddress(address)) {
    const err = new Error('Invalid Ethereum address.');
    err.code = 'BAD_ADDRESS';
    throw err;
  }
  const [wei, net, blockNumber] = await withTimeout(
    Promise.all([
      provider.getBalance(address),   // ← the real RPC call
      provider.getNetwork(),
      provider.getBlockNumber(),
    ])
  );
  return {
    address,
    network: net.name,
    chainId: Number(net.chainId),
    balanceWei: wei.toString(),
    balanceEth: ethers.formatEther(wei),   // human-readable ETH
    blockNumber,
  };
}

// Startup connectivity probe: logs the network + latest block, or the failure.
// Never throws — connectivity problems must not take the API down.
export async function logChainConnection() {
  const source = config.rpcUrl
    ? `RPC_URL ${redact(config.rpcUrl)}`
    : `ethers community default for "${config.rpcNetwork}"`;
  // Don't hang forever if the RPC is throttled/unreachable.
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timed out after 10s')), 10_000)
  );
  try {
    const [net, blockNumber] = await Promise.race([
      Promise.all([provider.getNetwork(), provider.getBlockNumber()]),
      timeout,
    ]);
    console.log(
      `⛓  Blockchain CONNECTED via ${source} → network "${net.name}" ` +
        `(chainId ${net.chainId}), latest block #${blockNumber}`
    );
    return { connected: true, network: net.name, chainId: Number(net.chainId), blockNumber };
  } catch (err) {
    console.warn(`⛓  Blockchain NOT connected via ${source} — ${err.shortMessage || err.message}`);
    if (!config.rpcUrl) {
      console.warn('   → Set RPC_URL in .env to a real endpoint (Infura/Alchemy/public RPC) to connect.');
    }
    return { connected: false, error: err.shortMessage || err.message };
  }
}
