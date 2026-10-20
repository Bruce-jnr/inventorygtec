export const levels = ['100', '200', '300', '400']
export function validateCandidate(body = {}) {
  const errors = {}
  const names = {}
  for (const [field, label] of [['surname', 'surname'], ['first_name', 'first name'], ['middle_name', 'middle name']]) {
    const raw = body[field]
    const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').toUpperCase() : ''
    names[field] = value
    if ((field !== 'middle_name' && !value) || (raw !== undefined && typeof raw !== 'string') || value.length > 50 || /[\x00-\x1f<>]/.test(value)) errors[field] = `Enter a valid ${label} (up to 50 characters).`
  }
  const name = [names.first_name, names.middle_name, names.surname].filter(Boolean).join(' ')
  const year = String(body.admission_year || '')
  if (!/^\d{4}$/.test(year) || Number(year) < 1950 || Number(year) > new Date().getUTCFullYear()) errors.admission_year = 'Select a valid admission year.'
  if (!levels.includes(body.current_level)) errors.current_level = 'Select a valid current level.'
  if (!['Regular', 'Matured'].includes(body.mode_of_entry)) errors.mode_of_entry = 'Select Regular or Matured as your mode of entry.'
  const dob = body.date_of_birth
  const date = typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(`${dob}T00:00:00Z`) : new Date(NaN)
  const today = new Date().toISOString().slice(0, 10)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dob || dob < '1900-01-01' || dob >= today) errors.date_of_birth = 'Enter a valid date of birth in the past (1900 or later).'
  if (!errors.date_of_birth && !errors.admission_year && Number(dob.slice(0, 4)) >= Number(year)) errors.date_of_birth = 'Date of birth must be before your admission year.'
  return { errors, value: { ...names, full_name: name, admission_year: Number(year), current_level: body.current_level, mode_of_entry: body.mode_of_entry, date_of_birth: dob } }
}
