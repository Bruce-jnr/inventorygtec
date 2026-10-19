export const levels = ['100', '200', '300', '400', '500', '600', 'Postgraduate']
export function validateCandidate(body = {}) {
  const errors = {}
  const name = typeof body.full_name === 'string' ? body.full_name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 2 || name.length > 150 || /[\x00-\x1f<>]/.test(name)) errors.full_name = 'Enter a full name between 2 and 150 characters.'
  const year = String(body.admission_year || '')
  if (!/^\d{4}$/.test(year) || Number(year) < 1950 || Number(year) > new Date().getUTCFullYear()) errors.admission_year = 'Select a valid admission year.'
  if (!levels.includes(body.current_level)) errors.current_level = 'Select a valid current level.'
  const dob = body.date_of_birth
  const date = typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(`${dob}T00:00:00Z`) : new Date(NaN)
  const today = new Date().toISOString().slice(0, 10)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dob || dob < '1900-01-01' || dob >= today) errors.date_of_birth = 'Enter a valid date of birth in the past (1900 or later).'
  if (!errors.date_of_birth && !errors.admission_year && Number(dob.slice(0, 4)) >= Number(year)) errors.date_of_birth = 'Date of birth must be before your admission year.'
  return { errors, value: { full_name: name, admission_year: Number(year), current_level: body.current_level, date_of_birth: dob } }
}
