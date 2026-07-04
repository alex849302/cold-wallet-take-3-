import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'

/**
 * ADMIN-ONLY hook. Fetches a specific user's LIVE on-chain balances
 * (ETH/SOL/BTC/USDT) from GET /api/portfolio/:userId/balances and shapes them
 * for the Chain Tools diagnostics UI. Refetches whenever `userId` changes.
 *
 * Returns:
 *   onchain    — { btc, eth, sol, tron, usdt_trc20, usdt_erc20 } numeric balances (0 on error)
 *   detail     — raw per-chain objects { ok, balance, network, error, … }
 *   loading    — true on first load for the current user (no data yet)
 *   refreshing — true on manual/background refresh (data already shown)
 *   error      — request-level error message, if the call itself failed
 *   fetchedAt  — ISO timestamp from the server
 *   refresh()  — manually re-fetch the current user
 *
 * On-chain truth is deliberately confined to admin screens; the regular user
 * dashboard reads DB-simulated balances from AppContext instead.
 */
export function useOnchainPortfolio(userId) {
  const [state, setState] = useState({ onchain: {}, detail: {}, fetchedAt: null, error: '' })
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const mounted = useRef(true)
  const hasData = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const load = useCallback(async () => {
    if (!userId) return
    hasData.current ? setRefreshing(true) : setLoading(true)
    try {
      const res = await api.adminPortfolioBalances(userId)
      if (!mounted.current) return
      const detail = res.balances || {}
      const onchain = {}
      for (const [asset, d] of Object.entries(detail)) {
        onchain[asset] = d?.ok ? parseFloat(d.balance) || 0 : 0
      }
      hasData.current = true
      setState({ onchain, detail, fetchedAt: res.fetchedAt, error: '' })
    } catch (e) {
      if (!mounted.current) return
      setState(s => ({ ...s, error: e.message || 'Failed to load on-chain balances' }))
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false) }
    }
  }, [userId])

  // Reset + fetch whenever the selected user changes.
  useEffect(() => {
    hasData.current = false
    setState({ onchain: {}, detail: {}, fetchedAt: null, error: '' })
    if (userId) load()
  }, [userId, load])

  return { ...state, loading, refreshing, refresh: load }
}
