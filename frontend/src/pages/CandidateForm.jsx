import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Check, CheckCircle2, LockKeyhole } from 'lucide-react'
import { api, getSession } from '../api/client'
import FileUpload from '../components/FileUpload'
import { formatDateOfBirth, parseDateOfBirth } from '../utils/dates'
import { Link } from 'react-router-dom'
import PrivateImage from '../components/PrivateImage'


const currentYear = new Date().getFullYear()
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const years = Array.from({ length: currentYear - 1949 }, (_, index) => currentYear - index)
const empty = { surname: '', first_name: '', middle_name: '', admission_year: '', current_level: '', mode_of_entry: '', date_of_birth: '' }
export default function CandidateForm({ initialCandidate = null, onFinishedEditing }) {
  const editing = Boolean(initialCandidate)
  const [form, setForm] = useState(() => initialCandidate ? Object.fromEntries(Object.keys(empty).map(key => [key, key === 'date_of_birth' ? formatDateOfBirth(initialCandidate[key]) : String(initialCandidate[key] ?? '')])) : empty)
  const [files, setFiles] = useState({ passport: null, certificate: null, certificate2: null })
  const [hasAnotherCertificate, setHasAnotherCertificate] = useState(initialCandidate?.has_second_certificate ? 'yes' : 'no')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(null)
  const [maxBytes, setMaxBytes] = useState(3 * 1024 * 1024)
  const [copied, setCopied] = useState(false)
  const pending = useRef(false)
  const requestKey = useRef(crypto.randomUUID())
  const resultRef = useRef(null)
  const calendarRef = useRef(null)
  useEffect(() => { getSession().then(data => setMaxBytes(data.maxUploadBytes)).catch(() => {}) }, [])
  useEffect(() => { if (success) resultRef.current?.focus() }, [success])
  function change(event) { const { name, value } = event.target; setForm(old => ({ ...old, [name]: value })); setErrors(old => ({ ...old, [name]: '' })) }
  function reset() { if (editing) { onFinishedEditing?.(); return }; setSuccess(null); setHasAnotherCertificate('no'); setForm(empty); setFiles({ passport: null, certificate: null, certificate2: null }); setErrors({}); setMessage(''); setCopied(false); requestKey.current = crypto.randomUUID() }
  async function submit(event) {
    event.preventDefault()
    if (pending.current) return
    const next = {}
    for (const [field, label] of [['surname', 'surname'], ['first_name', 'first name'], ['middle_name', 'middle name']]) {
      const value = form[field].trim()
      if ((field !== 'middle_name' && !value) || value.length > 50 || /[<>]/.test(value) || [...value].some(character => character.charCodeAt(0) < 32)) next[field] = `Enter a valid ${label} (up to 50 characters).`
    }
    if (!form.admission_year) next.admission_year = 'Select your admission year.'
    if (!form.current_level) next.current_level = 'Select your current level.'
    if (!['Regular', 'Matured'].includes(form.mode_of_entry)) next.mode_of_entry = 'Select your mode of entry.'
    const today = new Date().toISOString().slice(0, 10)
    const dateOfBirth = parseDateOfBirth(form.date_of_birth)
    if (!dateOfBirth || dateOfBirth >= today || dateOfBirth < '1900-01-01') next.date_of_birth = 'Enter a valid past date in DD/MM/YYYY format (1900 or later).'
    else if (form.admission_year && Number(dateOfBirth.slice(0, 4)) >= Number(form.admission_year)) next.date_of_birth = 'Date of birth must be before your admission year.'
    for (const key of ['passport', 'certificate']) if (!files[key] && !editing) next[key] = `Upload your ${key === 'passport' ? 'passport photo' : 'certificate image'}.`
    if (errors.certificate2) next.certificate2 = errors.certificate2
    setErrors(next)
    setMessage('')
    if (Object.keys(next).length) { setMessage('Please check the highlighted fields before submitting.'); document.getElementById(Object.keys(next)[0])?.focus(); return }
    pending.current = true
    setBusy(true)
    try {
      const body = new FormData()
      Object.entries(form).forEach(([key, value]) => body.append(key, key === 'date_of_birth' ? dateOfBirth : value))
      Object.entries(files).forEach(([key, value]) => { if (value) body.append(key, value) })
      if (editing) body.append('remove_second_certificate', String(hasAnotherCertificate === 'no'))
      const result = await api(editing ? '/api/student/me' : '/api/candidates', { method: editing ? 'PUT' : 'POST', body, headers: editing ? { 'If-Match': String(initialCandidate.revision) } : { 'Idempotency-Key': requestKey.current } })
      setSuccess(result)
      if (editing) await api('/api/student/end-access', { method: 'POST', body: '{}' }).catch(() => {})
    } catch (error) { setErrors(error.errors || {}); setMessage(error.message) }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className="registration-band"><div className="registration-page page-wrap" id="registration-form">

      {!editing && !success && <div className="retrieve-prompt"><span>Already registered?</span><Link to="/retrieve" className="text-button">Retrieve and correct your form</Link></div>}
      {success ? <section className="form-card success-card" tabIndex={-1} ref={resultRef}><span className="success-icon"><CheckCircle2 size={42} /></span><span className="eyebrow">REGISTRATION COMPLETE</span><h2>{editing ? "Corrections saved." : "You’re all registered."}</h2><p>Thank you, {[form.first_name, form.middle_name, form.surname].map(name => name.trim()).filter(Boolean).join(' ')}. Your details and documents have been submitted successfully.</p><div className="reference-box"><small>YOUR REGISTRATION REFERENCE</small><strong>{success.reference}</strong><button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(success.reference); setCopied(true) } catch { setMessage('Select and copy the reference above.') } }}>{copied ? 'Copied to clipboard' : 'Copy reference'}</button></div><p className="muted">Save this reference for your records.</p>{message && <p role="status">{message}</p>}<button className="primary-button" onClick={reset}>{editing ? "Done" : "Register another candidate"} <ArrowRight size={18} /></button></section> : <form className="form-card" noValidate onSubmit={submit}>
        <div className="form-card-title"><div><h2>{editing ? "Correct your registration" : "Candidate registration"}</h2><p>Complete the form below to get started.</p></div><span className="secure-badge"><LockKeyhole size={13} />Secure form</span></div>
        <fieldset disabled={busy}><legend><span className="step-number">01</span><span>Personal information<small>Tell us a little about yourself.</small></span></legend>
          <div className="name-fields">{[['surname', 'Surname', 'family-name'], ['first_name', 'First name', 'given-name'], ['middle_name', 'Middle name', 'additional-name']].map(([name, label, autoComplete]) => <div className="field" key={name}><label htmlFor={name}>{label} {name === 'middle_name' ? <span className="optional-label">(optional)</span> : <span className="required">*</span>}</label><input id={name} name={name} autoComplete={autoComplete} maxLength={50} placeholder={`Enter your ${label.toLowerCase()}`} value={form[name]} onChange={change} aria-required={name !== 'middle_name'} aria-invalid={Boolean(errors[name])} aria-describedby={`${name}-error`} /><span className="field-error" id={`${name}-error`}>{errors[name]}</span></div>)}</div>
          <div className="field-row"><div className="field"><label htmlFor="admission_year">Year of admission <span className="required">*</span></label><select id="admission_year" name="admission_year" value={form.admission_year} onChange={change} aria-invalid={Boolean(errors.admission_year)} aria-describedby="admission_year-error"><option value="">Select year</option>{years.map(year => <option key={year}>{year}</option>)}</select><span id="admission_year-error" className="field-error">{errors.admission_year}</span></div><div className="field"><label htmlFor="current_level">Current level <span className="required">*</span></label><select id="current_level" name="current_level" value={form.current_level} onChange={change} aria-invalid={Boolean(errors.current_level)} aria-describedby="current_level-error"><option value="">Select level</option>{['100', '200', '300', '400'].map(level => <option key={level} value={level}>{`Level ${level}`}</option>)}</select><span id="current_level-error" className="field-error">{errors.current_level}</span></div></div>
          <div className="field"><label htmlFor="mode_of_entry">Mode of entry <span className="required">*</span></label><select id="mode_of_entry" name="mode_of_entry" value={form.mode_of_entry} onChange={change} aria-required="true" aria-invalid={Boolean(errors.mode_of_entry)} aria-describedby="mode_of_entry-error"><option value="">Select mode of entry</option><option value="Regular">Regular</option><option value="Matured">Matured</option></select><span id="mode_of_entry-error" className="field-error">{errors.mode_of_entry}</span></div>
          <div className="field dob-field"><label htmlFor="date_of_birth">Date of birth <span className="required">*</span></label><div className="dob-input-wrap"><input id="date_of_birth" name="date_of_birth" type="text" inputMode="numeric" autoComplete="bday" placeholder="DD/MM/YYYY" maxLength={10} value={form.date_of_birth} onChange={change} aria-required="true" aria-invalid={Boolean(errors.date_of_birth)} aria-describedby="date_of_birth-help date_of_birth-error" /><button type="button" className="calendar-button" aria-label="Choose date of birth from calendar" onClick={() => { if (calendarRef.current.showPicker) calendarRef.current.showPicker(); else calendarRef.current.click() }}><CalendarDays size={20} /></button><input ref={calendarRef} className="native-date-picker" type="date" tabIndex={-1} aria-hidden="true" min="1900-01-01" max={yesterday} value={parseDateOfBirth(form.date_of_birth)} onChange={event => { setForm(old => ({ ...old, date_of_birth: event.target.value ? formatDateOfBirth(event.target.value) : '' })); setErrors(old => ({ ...old, date_of_birth: '' })) }} /></div><p id="date_of_birth-help" className="field-help">DD/MM/YYYY, e.g. 17/02/2003</p><span id="date_of_birth-error" className="field-error">{errors.date_of_birth}</span></div>
        </fieldset>
        <fieldset disabled={busy} className="documents-section">
          <legend><span className="step-number">02</span><span>Supporting documents<small>Upload clear images so we can verify your records.</small></span></legend>
          <div className="uploads-grid">{['passport', 'certificate'].map(name => <FileUpload key={name} name={name} label={name === 'passport' ? 'Passport photograph' : 'Certificate image'} help={name === 'passport' ? 'A recent photo with a plain background.' : 'Make sure all text is clearly visible.'} existingImage={editing ? <PrivateImage student kind={name} alt={`Saved ${name === "passport" ? "passport photograph" : "certificate"}`} /> : null} file={files[name]} maxBytes={maxBytes} disabled={busy} error={errors[name]} onChange={(file, error) => { setFiles(old => ({ ...old, [name]: file })); setErrors(old => ({ ...old, [name]: error })) }} />)}</div>
          <div className="additional-certificate-question"><label htmlFor="another-certificate">Do you have another result or certificate?</label><select id="another-certificate" value={hasAnotherCertificate} onChange={event => { const value = event.target.value; setHasAnotherCertificate(value); if (value === 'no') { setFiles(old => ({ ...old, certificate2: null })); setErrors(old => ({ ...old, certificate2: '' })) } }}><option value="no">No</option><option value="yes">Yes</option></select></div>
          {hasAnotherCertificate === 'yes' && <div className="uploads-grid"><FileUpload name="certificate2" label="Second certificate" required={false} help="Make sure all text is clearly visible." existingImage={editing && initialCandidate.has_second_certificate ? <PrivateImage student kind="certificate2" alt="Saved second certificate" /> : null} file={files.certificate2} maxBytes={maxBytes} disabled={busy} error={errors.certificate2} onChange={(file, error) => { setFiles(old => ({ ...old, certificate2: file })); setErrors(old => ({ ...old, certificate2: error })) }} /></div>}
        </fieldset>
        <div className="submission-section"><p className="submission-note"><Check size={16} />By submitting, you confirm that these details are accurate.</p>{message && <div role="alert" className="alert error-alert">{message}</div>}<button className="primary-button submit-button" type="submit" disabled={busy}>{busy ? <><span className="spinner" />Submitting your registration…</> : <>{editing ? "Resubmit corrections" : "Submit registration"} <ArrowRight size={18} /></>}</button><p className="required-note"><span>*</span> Required fields are marked with *. Middle name and second certificate are optional.</p></div>
      </form>}
  </div></div>
}






