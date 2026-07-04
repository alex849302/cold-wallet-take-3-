import React from 'react'
import { useApp } from '../../context/AppContext'
import { useSupport } from '../../context/SupportContext'
import { useAdminReplyBridge } from '../../lib/ticketStore'
import MainLayout   from '../Layout/MainLayout'
import Overview     from '../Dashboard/Overview'
import TransactionHistory from '../Transactions/TransactionHistory'
import SupportView  from '../Support/SupportView'
import SettingsView from '../Settings/SettingsView'

/* Page registry for the authenticated user wallet.
   Send/Receive are no longer routes — they open as overlays on the Dashboard. */
const PAGES = {
  dashboard:  Overview,
  history:    TransactionHistory,
  support:    SupportView,
  settings:   SettingsView,
}

export default function UserDashboard() {
  const { currentPage, user } = useApp()
  const { messages } = useSupport()
  // Global bridge: pull admin replies from the backend support thread into the
  // ticket store so the chat + sidebar badge update live on any page.
  useAdminReplyBridge(user?.uid, messages)

  const PageComponent = PAGES[currentPage] || Overview

  return (
    <MainLayout>
      <div className="page-enter">
        <PageComponent />
      </div>
    </MainLayout>
  )
}
