import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../components/AuthProvider'

export default function AdminLogin() {
  const { admin, setAdmin, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setError(''); setBusy(true)
    try { const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }); setAdmin(result.admin); navigate('/admin', { replace: true }) }
    catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  if (!loading && admin) return <Navigate to="/admin" replace />
  return <div className="login-page page-wrap"><form className="form-card login-card" onSubmit={submit}><span className="login-lock"><LockKeyhole size={24} /></span><h2>Welcome back</h2><p>Sign in to your admin workspace.</p><div className="field"><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username" maxLength={100} required disabled={busy} /></div><div className="field"><label htmlFor="password">Password</label><div className="password-field"><input id="password" name="password" autoComplete="current-password" type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required disabled={busy} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>{error && <div className="alert error-alert" role="alert">{error}</div>}<button type="submit" className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={18} /></button><p className="login-footnote"><LockKeyhole size={13} />For authorized administrators only</p></form></div>
}

