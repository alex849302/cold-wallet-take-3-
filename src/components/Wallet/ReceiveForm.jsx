import React, { useState } from 'react'
import { QrCode, Copy, Check, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../../context/AppContext'

/* ── Real, scannable QR code (qrcode.react) ─────────────
   level="H" (30% error correction) so the centered token badge never breaks
   scannability. The white `.qr-wrapper` provides the quiet-zone background. */
function AddressQR({ address, asset, size = 200 }) {
  return (
    <div className="qr-wrapper">
      <div className="relative" style={{ width: size, height: size }}>
        <QRCodeSVG
          value={address || ''}
          size={size}
          level="H"
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#0B0E11"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        {/* Centered token badge, like standard crypto wallets */}
        {asset && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="flex items-center justify-center rounded-full font-bold shadow"
              style={{
                width: 40, height: 40, fontSize: 11,
                background: '#fff',
                border: `2px solid ${asset.color || '#00E676'}`,
                color: asset.color || '#00E676',
              }}
            >
              {asset.symbol}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main Receive Form ──────────────────────────────── */
export default function ReceiveForm() {
  const { assets } = useApp()
  const [assetId, setAssetId] = useState('eth')
  const [copied, setCopied]   = useState(false)

  const asset = assets.find(a => a.id === assetId)

  const handleCopy = () => {
    navigator.clipboard.writeText(asset.address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="glass rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neon-green/10 border border-neon-green/25 flex items-center justify-center">
            <QrCode size={16} className="text-neon-green" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Receive Crypto</h2>
            <p className="text-xs text-gray-500">Share your deposit address</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Asset selector */}
          <div>
            <label className="label-xs">Select Asset</label>
            <div className="relative mt-1.5">
              <select
                className="wallet-input appearance-none pr-10 cursor-pointer"
                value={assetId}
                onChange={e => setAssetId(e.target.value)}
              >
                {assets.map(a => (
                  <option key={a.id} value={a.id} style={{ background: '#1E2329' }}>
                    {a.name} ({a.symbol})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Network badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neon-green/5 border border-neon-green/15">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
            <span className="text-xs text-gray-400">Network:</span>
            <span className="text-xs text-neon-green font-medium">{asset?.network}</span>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <AddressQR address={asset?.address} asset={asset} size={200} />
          </div>

          {/* Address */}
          <div>
            <label className="label-xs mb-1.5 block">Your {asset?.symbol} Address</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-xl bg-dark-400/60 border border-white/8 font-mono text-xs text-gray-300 break-all select-all">
                {asset?.address}
              </div>
              <button onClick={handleCopy}
                className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                  copied
                    ? 'bg-neon-green/15 border-neon-green/35 text-neon-green'
                    : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20 hover:bg-white/5'
                }`}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            {copied && <p className="text-xs text-neon-green mt-1">Address copied to clipboard!</p>}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-neon-amber/8 border border-neon-amber/20 text-xs text-neon-amber">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>Only send <strong>{asset?.symbol}</strong> to this address on the <strong>{asset?.network}</strong> network. Sending other tokens may result in permanent loss.</p>
          </div>

          {/* Refresh note */}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <RefreshCw size={11} />
            This address is derived from your HD wallet. It's always yours.
          </div>
        </div>
      </div>
    </div>
  )
}
