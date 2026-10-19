import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ArrowUpRight, GraduationCap, LayoutDashboard, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { api } from '../api/client'

export default function Layout() {
  const { admin, setAdmin } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  async function logout() {
    setBusy(true)
    try {
      await api('/api/admin/logout', { method: 'POST' })
      setAdmin(null)
      setMenuOpen(false)
      navigate('/admin/login')
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="app-shell">
      <a className="skip-link no-print" href="#main-content">Skip to content</a>
      <header className="site-header no-print" onKeyDown={event => { if (event.key === 'Escape') setMenuOpen(false) }}>
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="Candidate Registry home" onClick={() => setMenuOpen(false)}>
            <span className="brand-icon"><GraduationCap size={24} strokeWidth={1.7} /></span>
            <span>Candidate<span className="brand-light">Registry</span></span>
          </Link>
          <div className="header-actions">
            <nav id="main-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Main navigation">
              <NavLink to="/" end onClick={() => setMenuOpen(false)}>Registration</NavLink>
              {admin && <>
                <NavLink to="/admin" onClick={() => setMenuOpen(false)}><LayoutDashboard size={16} />Dashboard</NavLink>
                <button className="nav-logout" disabled={busy} onClick={logout}><LogOut size={16} />{busy ? 'Signing out…' : 'Sign out'}</button>
              </>}
            </nav>
            {!admin && <NavLink className="admin-link" to="/admin/login" onClick={() => setMenuOpen(false)}>Admin portal <ArrowUpRight size={16} /></NavLink>}
            <button className="menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(open => !open)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {error && <div role="alert" className="header-error">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      </header>
      <main id="main-content"><Outlet /></main>
      <footer className="site-footer no-print"><div><Link className="footer-brand" to="/">Candidate Registry</Link><span><ShieldCheck size={16} />Your records. Handled with care.</span><span>© {new Date().getFullYear()} Candidate Registry</span></div></footer>
    </div>
  )
}
