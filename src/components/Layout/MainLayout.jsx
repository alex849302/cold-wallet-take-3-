import React, { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import SupportWidget from '../Support/SupportWidget'

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const close = () => setSidebarOpen(false)

  return (
    <div className="flex h-screen bg-dark-400 overflow-hidden">
      {/* Mobile backdrop — fades in/out with the drawer */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />

      <Sidebar open={sidebarOpen} onClose={close} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(o => !o)} sidebarOpen={sidebarOpen} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>

      {/* Global floating live-chat widget — persists across every page */}
      <SupportWidget />
    </div>
  )
}
