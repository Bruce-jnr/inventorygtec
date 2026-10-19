import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileImage, Printer, ShieldCheck } from 'lucide-react'
import { api } from '../api/client'
import PrivateImage from '../components/PrivateImage'

export default function CandidateDetails({ printView = false }) {
  const { id } = useParams()
  const [candidate, setCandidate] = useState(null)
  const [error, setError] = useState('')
  const [passportReady, setPassportReady] = useState(false)
  const [certificateReady, setCertificateReady] = useState(false)
  const [includeCertificate, setIncludeCertificate] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    api(`/api/admin/candidates/${id}`, { signal: controller.signal }).then(setCandidate).catch(error => { if (error.name !== 'AbortError') setError(error.message) })
    return () => controller.abort()
  }, [id])
  if (error) return <div className="page-wrap empty-state" role="alert"><h1>Record unavailable</h1><p>{error}</p><Link className="secondary-button" to="/admin">Back to records</Link></div>
  if (!candidate) return <div className="page-wrap empty-state" role="status">Loading candidate record…</div>
  const date = new Date(`${candidate.date_of_birth}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  return <div className={`detail-page page-wrap ${printView ? 'print-view' : ''}`}><Link to={printView ? `/admin/candidates/${id}` : '/admin'} className="back-link no-print"><ArrowLeft size={16} />{printView ? 'Back to candidate' : 'Back to candidate records'}</Link><div className="dashboard-heading no-print"><div><span className="eyebrow">{printView ? 'PRINT PREVIEW' : 'CANDIDATE RECORD'}</span><h1>{printView ? 'Ready for your records.' : candidate.full_name}</h1><p>{printView ? 'Review the record below before printing on A4 paper.' : 'Review personal information and supporting documents.'}</p></div>{printView ? <button className="primary-button" disabled={!passportReady || (includeCertificate && !certificateReady)} onClick={() => window.print()}><Printer size={17} />{!passportReady || (includeCertificate && !certificateReady) ? 'Loading images…' : 'Print record'}</button> : <Link className="primary-button" to={`/admin/candidates/${id}/print`}><Printer size={17} />Print record</Link>}</div>
    {printView && <label className="print-option no-print"><input type="checkbox" checked={includeCertificate} onChange={event => { setIncludeCertificate(event.target.checked); setCertificateReady(false) }} />Include certificate on a separate page</label>}
    <article className="candidate-sheet"><div className="sheet-header"><div><span className="eyebrow">CANDIDATE REGISTRY</span><h2>Candidate registration record</h2><span className="sheet-reference">{candidate.reference}</span></div><span className="verified-label"><ShieldCheck size={16} />Registered</span></div><div className="sheet-body"><div className="sheet-fields"><h3>Personal information</h3><dl><div><dt>Full name</dt><dd>{candidate.full_name}</dd></div><div><dt>Year of admission</dt><dd>{candidate.admission_year}</dd></div><div><dt>Current level</dt><dd>{candidate.current_level === 'Postgraduate' ? candidate.current_level : `Level ${candidate.current_level}`}</dd></div><div><dt>Date of birth</dt><dd>{date}</dd></div><div><dt>Registration reference</dt><dd className="monospace">{candidate.reference}</dd></div></dl></div><div className="passport-frame"><PrivateImage key={`passport-${id}`} candidateId={id} kind="passport" alt={`Passport photograph of ${candidate.full_name}`} onReady={() => setPassportReady(true)} /><span>Passport photograph</span></div></div><div className="sheet-footer">Registered on {new Date(candidate.created_at.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}<span>Private candidate record</span></div></article>
    {(!printView || includeCertificate) && <section className={`certificate-card ${printView ? 'certificate-print-page' : ''}`}><div><FileImage size={19} /><h2>Certificate</h2></div><p>{candidate.full_name} · {candidate.reference}</p><PrivateImage key={`certificate-${id}`} candidateId={id} kind="certificate" alt={`Certificate submitted by ${candidate.full_name}`} onReady={() => setCertificateReady(true)} /></section>}
  </div>
}

