import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { parseDateOfBirth } from '../utils/dates'
import CandidateForm from './CandidateForm'

export default function RetrieveRegistration() {
  const [reference, setReference] = useState('')
  const [dob, setDob] = useState('')
  const [candidate, setCandidate] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function retrieve(event) {
    event.preventDefault()
    if (busy) return
    const date = parseDateOfBirth(dob)
    if (!date) { setError('Enter your date of birth in DD/MM/YYYY format.'); return }
    setBusy(true); setError('')
    try { const result = await api('/api/student/access', { method: 'POST', body: JSON.stringify({ reference, date_of_birth: date }) }); setCandidate(result.candidate) }
    catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  async function close() {
    setBusy(true); setError('')
    try { await api('/api/student/end-access', { method: 'POST', body: '{}' }); setCandidate(null) }
    catch (error) { if (error.status === 401) setCandidate(null); else setError(error.message) }
    finally { setBusy(false) }
  }
  if (candidate) return <>
    <div className="editing-banner"><span>Editing registration <strong>{candidate.reference}</strong></span><button className="text-button" disabled={busy} onClick={close}>Close registration</button>{error && <p role="alert">{error}</p>}</div>
    <CandidateForm initialCandidate={candidate} onFinishedEditing={() => setCandidate(null)} />
  </>
  return <div className="login-page page-wrap"><form className="form-card login-card" onSubmit={retrieve}>
    <h2>Retrieve your registration</h2><p>Enter your reference and date of birth to review and correct your form.</p>
    <div className="field"><label htmlFor="lookup-reference">Registration reference</label><input id="lookup-reference" value={reference} onChange={event => setReference(event.target.value)} placeholder="CAN-2026-…" maxLength={40} autoComplete="off" required disabled={busy} /></div>
    <div className="field"><label htmlFor="lookup-dob">Date of birth</label><input id="lookup-dob" value={dob} onChange={event => setDob(event.target.value)} placeholder="DD/MM/YYYY" inputMode="numeric" maxLength={10} autoComplete="bday" required disabled={busy} /></div>
    {error && <div className="alert error-alert" role="alert">{error}</div>}
    <button className="primary-button" disabled={busy}>{busy ? 'Retrieving…' : 'Retrieve registration'}<ArrowRight size={18} /></button>
    <Link className="text-button retrieve-back" to="/">Start a new registration</Link>
  </form></div>
}
