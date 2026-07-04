import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider }  from './context/ThemeContext'
import { AuthProvider }   from './context/AuthContext'
import { MarketProvider } from './context/MarketContext'
import { TransactionsProvider } from './context/TransactionsContext'
import { SupportProvider } from './context/SupportContext'
import { UsersProvider }   from './context/UsersContext'
import { AppProvider }    from './context/AppContext'
import { NotificationProvider } from './context/NotificationContext'
import './index.css'

// Fully API-backed: no localStorage data layer. Each provider owns one slice
// of server state (session, prices, transactions, support, users).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>              {/* light / dark mode + localStorage */}
    <AuthProvider>               {/* session via API (JWT) */}
      <MarketProvider>           {/* live Binance prices */}
        <TransactionsProvider>   {/* transactions via API */}
          <SupportProvider>      {/* support chat via API */}
            <UsersProvider>      {/* admin user management via API */}
              <AppProvider>      {/* derived per-user wallet view + actions */}
                <NotificationProvider> {/* bell dropdown + real-time toasts */}
                  <App />
                </NotificationProvider>
              </AppProvider>
            </UsersProvider>
          </SupportProvider>
        </TransactionsProvider>
      </MarketProvider>
    </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)
