import { createContext, useContext, useEffect, useState } from 'react'
import { getSession } from '../api/client'

const AuthContext = createContext(null)
// Context hook is intentionally exported alongside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function refresh() {
    setLoading(true)
    setError('')
    try { const session = await getSession(); setAdmin(session.admin) }
    catch { setError('We cannot connect to the registration service. Please try again.'); setAdmin(null) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    getSession().then(data => { if (active) setAdmin(data.admin) }).catch(() => { if (active) setError('We cannot connect to the registration service. Please try again.') }).finally(() => { if (active) setLoading(false) })
    const expire = () => setAdmin(null)
    window.addEventListener('session-expired', expire)
    return () => { active = false; window.removeEventListener('session-expired', expire) }
  }, [])
  function updateAdmin(value) { setAdmin(value); if (value) setError('') }
  return <AuthContext.Provider value={{ admin, setAdmin: updateAdmin, loading, error, refresh }}>{children}</AuthContext.Provider>
}
