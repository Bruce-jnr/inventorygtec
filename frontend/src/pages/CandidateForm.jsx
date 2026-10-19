import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, CheckCircle2, LockKeyhole } from 'lucide-react'
import { api, getSession } from '../api/client'
import FileUpload from '../components/FileUpload'


const currentYear = new Date().getFullYear()
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const years = Array.from({ length: currentYear - 1949 }, (_, index) => currentYear - index)
const empty = { full_name: '', admission_year: '', current_level: '', date_of_birth: '' }
export default function CandidateForm() {
  const [form, setForm] = useState(empty)
  const [files, setFiles] = useState({ passport: null, certificate: null })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(null)
  const [maxBytes, setMaxBytes] = useState(3 * 1024 * 1024)
  const [copied, setCopied] = useState(false)
  const pending = useRef(false)
  const requestKey = useRef(crypto.randomUUID())
  const resultRef = useRef(null)
  useEffect(() => { getSession().then(data => setMaxBytes(data.maxUploadBytes)).catch(() => {}) }, [])
  useEffect(() => { if (success) resultRef.current?.focus() }, [success])
  function change(event) { const { name, value } = event.target; setForm(old => ({ ...old, [name]: value })); setErrors(old => ({ ...old, [name]: '' })) }
  function reset() { setSuccess(null); setForm(empty); setFiles({ passport: null, certificate: null }); setErrors({}); setMessage(''); setCopied(false); requestKey.current = crypto.randomUUID() }
  async function submit(event) {
    event.preventDefault()
    if (pending.current) return
    const next = {}
    if (form.full_name.trim().length < 2 || form.full_name.trim().length > 150) next.full_name = 'Enter your full name (2–150 characters).'
    if (!form.admission_year) next.admission_year = 'Select your admission year.'
    if (!form.current_level) next.current_level = 'Select your current level.'
    const today = new Date().toISOString().slice(0, 10)
    if (!form.date_of_birth || form.date_of_birth >= today || form.date_of_birth < '1900-01-01') next.date_of_birth = 'Enter a valid date of birth in the past.'
    else if (form.admission_year && Number(form.date_of_birth.slice(0, 4)) >= Number(form.admission_year)) next.date_of_birth = 'Date of birth must be before your admission year.'
    for (const key of ['passport', 'certificate']) if (!files[key]) next[key] = `Upload your ${key === 'passport' ? 'passport photo' : 'certificate image'}.`
    setErrors(next)
    setMessage('')
    if (Object.keys(next).length) { setMessage('Please check the highlighted fields before submitting.'); document.getElementById(Object.keys(next)[0])?.focus(); return }
    pending.current = true
    setBusy(true)
    try {
      const body = new FormData()
      Object.entries(form).forEach(([key, value]) => body.append(key, value))
      Object.entries(files).forEach(([key, value]) => body.append(key, value))
      const result = await api('/api/candidates', { method: 'POST', body, headers: { 'Idempotency-Key': requestKey.current } })
      setSuccess(result)
    } catch (error) { setErrors(error.errors || {}); setMessage(error.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className="registration-band"><div className="registration-page page-wrap" id="registration-form">

      {success ? <section className="form-card success-card" tabIndex={-1} ref={resultRef}><span className="success-icon"><CheckCircle2 size={42} /></span><span className="eyebrow">REGISTRATION COMPLETE</span><h2>You’re all registered.</h2><p>Thank you, {form.full_name.trim()}. Your details and documents have been submitted successfully.</p><div className="reference-box"><small>YOUR REGISTRATION REFERENCE</small><strong>{success.reference}</strong><button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(success.reference); setCopied(true) } catch { setMessage('Select and copy the reference above.') } }}>{copied ? 'Copied to clipboard' : 'Copy reference'}</button></div><p className="muted">Save this reference for your records.</p>{message && <p role="status">{message}</p>}<button className="primary-button" onClick={reset}>Register another candidate <ArrowRight size={18} /></button></section> : <form className="form-card" noValidate onSubmit={submit}>
        <div className="form-card-title"><div><h2>Candidate registration</h2><p>Complete the form below to get started.</p></div><span className="secure-badge"><LockKeyhole size={13} />Secure form</span></div>
        <fieldset disabled={busy}><legend><span className="step-number">01</span><span>Personal information<small>Tell us a little about yourself.</small></span></legend>
          <div className="field"><label htmlFor="full_name">Full name <span className="required">*</span></label><input id="full_name" name="full_name" autoComplete="name" maxLength={150} placeholder="Enter your full name" value={form.full_name} onChange={change} aria-invalid={Boolean(errors.full_name)} aria-describedby="full_name-error" /><span className="field-error" id="full_name-error">{errors.full_name}</span></div>
          <div className="field-row"><div className="field"><label htmlFor="admission_year">Year of admission <span className="required">*</span></label><select id="admission_year" name="admission_year" value={form.admission_year} onChange={change} aria-invalid={Boolean(errors.admission_year)} aria-describedby="admission_year-error"><option value="">Select year</option>{years.map(year => <option key={year}>{year}</option>)}</select><span id="admission_year-error" className="field-error">{errors.admission_year}</span></div><div className="field"><label htmlFor="current_level">Current level <span className="required">*</span></label><select id="current_level" name="current_level" value={form.current_level} onChange={change} aria-invalid={Boolean(errors.current_level)} aria-describedby="current_level-error"><option value="">Select level</option>{['100', '200', '300', '400', '500', '600', 'Postgraduate'].map(level => <option key={level} value={level}>{level === 'Postgraduate' ? level : `Level ${level}`}</option>)}</select><span id="current_level-error" className="field-error">{errors.current_level}</span></div></div>
          <div className="field dob-field"><label htmlFor="date_of_birth">Date of birth <span className="required">*</span></label><input id="date_of_birth" name="date_of_birth" type="date" autoComplete="bday" min="1900-01-01" max={yesterday} value={form.date_of_birth} onChange={change} aria-invalid={Boolean(errors.date_of_birth)} aria-describedby="date_of_birth-error" /><span id="date_of_birth-error" className="field-error">{errors.date_of_birth}</span></div>
        </fieldset>
        <fieldset disabled={busy} className="documents-section"><legend><span className="step-number">02</span><span>Supporting documents<small>Upload clear images so we can verify your records.</small></span></legend><div className="uploads-grid">{['passport', 'certificate'].map(name => <FileUpload key={name} name={name} label={name === 'passport' ? 'Passport photograph' : 'Certificate image'} help={name === 'passport' ? 'A recent photo with a plain background.' : 'Make sure all text is clearly visible.'} file={files[name]} maxBytes={maxBytes} disabled={busy} error={errors[name]} onChange={(file, error) => { setFiles(old => ({ ...old, [name]: file })); setErrors(old => ({ ...old, [name]: error })) }} />)}</div></fieldset>
        <div className="submission-section"><p className="submission-note"><Check size={16} />By submitting, you confirm that these details are accurate.</p>{message && <div role="alert" className="alert error-alert">{message}</div>}<button className="primary-button submit-button" type="submit" disabled={busy}>{busy ? <><span className="spinner" />Submitting your registration…</> : <>Submit registration <ArrowRight size={18} /></>}</button><p className="required-note"><span>*</span> All fields are required. Please review before submitting.</p></div>
      </form>}
  </div></div>
}

