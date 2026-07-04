import React, { useState, useCallback } from 'react'
import { Activity, RefreshCw, Cpu, Search, AlertCircle, Copy, Check } from 'lucide-react'
import { api } from '../../lib/api'

/**
 * Admin-only on-chain debugging tool — MULTI-CHAIN.
 *
 * Reads ANY address's REAL balance via GET /api/wallet/:address/onchain-balance.
 * The backend detects the network from the address format and routes to the
 * matching configured endpoint (RPC_URL / TRON_RPC_URL / SOLANA_RPC_URL /
 * BITCOIN_API_URL), returning the native balance (+ USDT on EVM/TRON), each
 * formatted with the correct decimals. No background polling — fetch on demand.
 */

const CHAIN_META = {
  ethereum: { label: 'Ethereum', color: '#627EEA' },
  tron:     { label: 'TRON',     color: '#EB0029' },
  bitcoin:  { label: 'Bitcoin',  color: '#F7931A' },
  solana:   { label: 'Solana',   color: '#14F195' },
}

// Lightweight client-side hint shown as you type — the backend is authoritative.
function guessChain(a) {
  const s = (a || '').trim()
  if (!s) return null
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return 'ethereum'
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s)) return 'tron'
  if (/^(bc1[0-9ac-hj-np-z]{6,}|[13][1-9A-HJ-NP-Za-km-z]{24,33})$/.test(s)) return 'bitcoin'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return 'solana'
  return null
}

function ChainChip({ chain }) {
  const meta = CHAIN_META[chain]
  if (!meta) return null
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${meta.color}1A`, border: `1px solid ${meta.color}40`, color: meta.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

export default function OnchainBalanceChecker() {
  const [address, setAddress] = useState('')
  const [state, setState] = useState({ loading: false, error: '', data: null })
  const [copied, setCopied] = useState(false)

  const typedGuess = guessChain(address)

  const check = useCallback(async (override) => {
    const addr = (typeof override === 'string' ? override : address).trim()
    if (!addr) {
      setState({ loading: false, error: 'Enter an address to check.', data: null })
      return
    }
    setState({ loading: true, error: '', data: null })
    try {
      const d = await api.onchainBalance(addr)
      setState({ loading: false, error: '', data: d })
    } catch (e) {
      setState({ loading: false, error: e.message || 'Could not reach the network.', data: null })
    }
  }, [address])

  const copy = () => {
    if (!state.data?.address) return
    navigator.clipboard?.writeText(state.data.address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const resultMeta = state.data && CHAIN_META[state.data.chain]

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
          <Activity size={16} className="text-neon-green" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">On-Chain Balance Checker</h2>
          <p className="text-xs text-gray-500">Read any BTC · ETH · SOL · TRON address's live balance · admin debugging only</p>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {/* Address input + Check */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label-xs">Address</label>
            {typedGuess && (
              <span className="text-[10px] text-gray-500 inline-flex items-center gap-1.5">
                detected <ChainChip chain={typedGuess} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') check() }}
              placeholder="BTC, ETH, SOL or TRON address…"
              spellCheck={false}
              className="wallet-input flex-1 font-mono text-xs"
            />
            <button onClick={() => check()} disabled={state.loading}
              className="btn-primary h-11 px-4 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50">
              {state.loading
                ? <><Cpu size={15} className="animate-spin" /> Reading…</>
                : <><Search size={15} /> Check</>}
            </button>
          </div>
        </div>

        {/* Error */}
        {state.error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-neon-red/10 border border-neon-red/25 text-neon-red text-sm">
            <AlertCircle size={15} className="shrink-0" /> {state.error}
          </div>
        )}

        {/* Result */}
        {state.data && (
          <div className="p-4 rounded-xl bg-dark-400/60 border border-white/8 space-y-3">
            {/* Network + address */}
            <div className="flex items-center gap-2">
              <ChainChip chain={state.data.chain} />
              <span className="font-mono text-xs text-gray-300 truncate flex-1" title={state.data.address}>{state.data.address}</span>
              <button onClick={copy} className="shrink-0 text-gray-500 hover:text-white transition-colors" title="Copy address">
                {copied ? <Check size={14} className="text-neon-green" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Per-asset balances */}
            <div className="border-t border-white/5 pt-3 space-y-2.5">
              {state.data.balances.map((b, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-gray-300">{b.unit}</span>
                    <span className="text-[10px] text-gray-600 ml-2">{b.decimals} decimals{b.contract ? ' · token' : ''}</span>
                    {!b.ok && <p className="text-[11px] text-neon-amber mt-0.5">{b.error}</p>}
                    {b.ok && <p className="text-[10px] text-gray-600 mt-0.5 font-mono truncate">{b.raw} base units</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-lg font-num font-semibold text-neon-green">
                      {b.ok ? b.balance : '—'} <span className="text-xs text-gray-500">{b.unit}</span>
                    </span>
                    {i === 0 && (
                      <button onClick={() => check(state.data.address)} disabled={state.loading}
                        className="text-gray-500 hover:text-white transition-colors disabled:opacity-40" title="Refresh">
                        <RefreshCw size={13} className={state.loading ? 'animate-spin' : ''} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-gray-600 border-t border-white/5 pt-2">
              network {state.data.network} · routed via the {resultMeta?.label || state.data.chain} endpoint
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
