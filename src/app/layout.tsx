import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Event Burn Calculator',
  description: 'Unmasking resource waste in Whiteout Survival',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <header className="app-header animate-slide-up">
            <div className="header-content">
              <h1><span className="title-gradient">Event Burn</span> Calculator</h1>
              <p className="subtitle">Whiteout Survival / Kingshot Resource Tracker</p>
            </div>
            <nav className="header-nav">
              <a href="/templates" className="nav-link">Event Manager</a>
              <a href="/" className="nav-link">Dashboard & Import</a>
            </nav>
          </header>
          
          <main className="main-content">
            {children}
          </main>
          
          <footer className="app-footer">
            <p>© {new Date().getFullYear()} Event Burn Calculator. For analytics purposes only.</p>
          </footer>
        </div>
      </body>
    </html>
  )
}
