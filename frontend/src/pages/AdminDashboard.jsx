import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Search, Users, X } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../components/AuthProvider'
import { candidateName } from '../utils/candidates'

export default function AdminDashboard() {
  const { admin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [stats, setStats] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const query = params.toString()
  useEffect(() => {
    const controller = new AbortController()
    api('/api/admin/stats', { signal: controller.signal }).then(setStats).catch(error => { if (error.name !== 'AbortError') setError(error.message) })
    return () => controller.abort()
  }, [retry])
  useEffect(() => {
    const controller = new AbortController()
    api(`/api/admin/candidates?${query}`, { signal: controller.signal }).then(data => { setData(data); setError(''); setLoading(false) }).catch(error => { if (error.name !== 'AbortError') { setError(error.message); setLoading(false) } })
    return () => controller.abort()
  }, [query, retry])
  function filter(key, value) { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); next.delete('page'); setLoading(true); setParams(next) }
  function page(number) { const next = new URLSearchParams(params); next.set('page', number); setLoading(true); setParams(next) }
  return <div className="dashboard-page page-wrap"><div className="dashboard-heading"><div><span className="eyebrow">ADMIN WORKSPACE</span><h1>Candidate overview<span>.</span></h1><p>Welcome, {admin.username}. Every registration, in one place.</p></div><Link to="/" className="secondary-button">Registration portal <ArrowRight size={16} /></Link></div>
    <div className="stats-grid">{[{ icon: Users, label: 'Total registrations', value: stats?.total, note: 'All candidate records' }, { icon: ClipboardList, label: 'Registered today', value: stats?.today, note: 'Since midnight UTC' }, { icon: CalendarDays, label: 'Admission years', value: stats?.admissionYears, note: 'Across all registrations' }].map(({ icon: Icon, ...stat }) => <div className="stat-card" key={stat.label}><span className="stat-icon"><Icon size={21} /></span><span>{stat.label}</span><strong>{stat.value ?? '—'}</strong><small>{stat.note}</small></div>)}</div>
    <section className="records-card"><div className="records-title"><div><h2>Candidate records</h2><p>Find a candidate to review their details and documents.</p></div><span className="count-badge">{data?.total ?? '—'} records</span></div>
      <div className="filters"><div className="search-field"><Search size={18} /><input aria-label="Search candidates by name" placeholder="Search by candidate name…" value={params.get('search') || ''} maxLength={150} onChange={event => filter('search', event.target.value)} /></div><select aria-label="Filter by admission year" value={params.get('year') || ''} onChange={event => filter('year', event.target.value)}><option value="">All admission years</option>{Array.from({ length: new Date().getFullYear() - 1949 }, (_, i) => new Date().getFullYear() - i).map(year => <option key={year}>{year}</option>)}</select><select aria-label="Filter by current level" value={params.get('level') || ''} onChange={event => filter('level', event.target.value)}><option value="">All levels</option>{['100', '200', '300', '400'].map(level => <option key={level} value={level}>{`Level ${level}`}</option>)}</select>{(params.get('search') || params.get('year') || params.get('level')) && <button className="clear-button" onClick={() => { setLoading(true); setParams({}) }}><X size={16} />Clear</button>}</div>
      {error ? <div className="empty-state" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => { setLoading(true); setRetry(value => value + 1) }}>Try again</button></div> : loading ? <div className="empty-state" role="status"><span className="spinner dark-spinner" />Loading candidate records…</div> : !data?.candidates.length ? <div className="empty-state"><span className="empty-icon"><Users size={30} /></span><h3>{query ? 'No matching candidates' : 'Ready for your first candidate'}</h3><p>{query ? 'Try a different name, admission year, or level.' : 'New registrations will appear here as soon as they are submitted.'}</p></div> : <><div className="table-scroll"><table><thead><tr><th>Candidate</th><th>Reference</th><th>Admission year</th><th>Current level</th><th>Registered</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.candidates.map(candidate => <tr key={candidate.id}><td><div className="candidate-name"><span className="avatar">{candidateName(candidate).split(' ').map(n => n[0]).slice(0, 2).join('')}</span><strong>{candidateName(candidate)}</strong></div></td><td className="reference-cell" data-label="Reference">{candidate.reference}</td><td data-label="Admission year">{candidate.admission_year}</td><td data-label="Current level"><span className="level-badge">{candidate.current_level === 'Postgraduate' ? 'Postgraduate' : `Level ${candidate.current_level}`}</span></td><td data-label="Registered">{new Date(candidate.created_at.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><Link className="view-link" to={`/admin/candidates/${candidate.id}`} aria-label={`View ${candidateName(candidate)}`}>View <ArrowRight size={15} /></Link></td></tr>)}</tbody></table></div><div className="pagination"><span>Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total} candidates</span><div><button disabled={data.page <= 1} onClick={() => page(data.page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {data.page} of {data.pages}</span><button disabled={data.page >= data.pages} onClick={() => page(data.page + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></div></>}
    </section><p className="records-privacy">Candidate records and documents are private. Only share them with authorized staff.</p>
  </div>
}



