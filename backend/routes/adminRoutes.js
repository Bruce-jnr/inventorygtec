import { Router } from 'express'
import bcrypt from 'bcrypt'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { rateLimit } from 'express-rate-limit'
import { requireAdmin } from '../middleware/auth.js'
import { levels } from '../validation.js'

const publicFields = 'id, reference, full_name, surname, first_name, middle_name, admission_year, current_level, mode_of_entry, date_of_birth, created_at, (certificate2_path IS NOT NULL) AS has_second_certificate'
const idPattern = /^[1-9]\d{0,19}$/

export function adminRoutes(pool, config) {
  const router = Router()
  // A fixed dummy hash keeps failed username lookups on the same bcrypt work path.
  const dummyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 12)
  router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many sign-in attempts. Try again in 15 minutes.' } }), async (req, res, next) => {
    const { username, password } = req.body || {}
    if (typeof username !== 'string' || username.trim().length > 100 || typeof password !== 'string' || Buffer.byteLength(password) > 72 || !password) return res.status(400).json({ message: 'Enter your username and password.' })
    const [rows] = await pool.execute('SELECT id, username, password_hash FROM admins WHERE username = ?', [username.trim()])
    const valid = await bcrypt.compare(password, rows[0]?.password_hash || dummyHash)
    if (!rows.length || !valid) return res.status(401).json({ message: 'The username or password is incorrect.' })
    req.session.regenerate(error => {
      if (error) return next(error)
      req.session.admin = { id: rows[0].id, username: rows[0].username }
      req.session.authExpiresAt = Date.now() + 60 * 60 * 1000
      req.session.csrfToken = randomBytes(32).toString('hex')
      req.session.save(saveError => saveError ? next(saveError) : res.json({ admin: req.session.admin, csrfToken: req.session.csrfToken }))
    })
  })
  router.use(requireAdmin)
  router.post('/logout', (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error)
      res.clearCookie('candidate.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: config.production })
      res.json({ message: 'Signed out successfully.' })
    })
  })
  router.get('/stats', async (req, res) => {
    const [[stats]] = await pool.execute('SELECT COUNT(*) AS total, COALESCE(SUM(DATE(created_at) = UTC_DATE()), 0) AS today, COUNT(DISTINCT admission_year) AS admissionYears FROM candidates')
    res.json({ total: Number(stats.total), today: Number(stats.today), admissionYears: Number(stats.admissionYears) })
  })
  router.get('/candidates', async (req, res) => {
    const { search = '', year = '', level = '', page = '1' } = req.query
    if ([search, year, level, page].some(v => typeof v !== 'string') || search.length > 150 || !/^[1-9]\d{0,5}$/.test(page) || (year && !/^\d{4}$/.test(year)) || (level && !levels.includes(level))) return res.status(400).json({ message: 'Invalid search filters.' })
    const conditions = []
    const params = []
    if (search.trim()) { conditions.push("full_name LIKE ? ESCAPE '!' "); params.push(`%${search.trim().replace(/[!%_]/g, '!$&')}%`) }
    if (year) { conditions.push('admission_year = ?'); params.push(Number(year)) }
    if (level) { conditions.push('current_level = ?'); params.push(level) }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
    const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM candidates${where}`, params)
    const total = Number(count.total)
    const pages = Math.max(1, Math.ceil(total / 10))
    const current = Math.min(Number(page), pages)
    const [rows] = await pool.execute(`SELECT ${publicFields} FROM candidates${where} ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET ${((current - 1) * 10)}`, params)
    res.json({ candidates: rows.map(row => ({ ...row, has_second_certificate: Number(row.has_second_certificate) === 1 })), total, page: current, pages, pageSize: 10 })
  })
  router.get('/candidates/:id', async (req, res) => {
    if (!idPattern.test(req.params.id)) return res.status(400).json({ message: 'Invalid candidate reference.' })
    const [rows] = await pool.execute(`SELECT ${publicFields} FROM candidates WHERE id = ?`, [req.params.id])
    if (!rows.length) return res.status(404).json({ message: 'Candidate record not found.' })
    res.json({ ...rows[0], has_second_certificate: Number(rows[0].has_second_certificate) === 1 })
  })
  router.get('/candidates/:id/:image', async (req, res, next) => {
    if (!idPattern.test(req.params.id) || !['passport', 'certificate', 'certificate2'].includes(req.params.image)) return res.status(404).json({ message: 'Image not found.' })
    const column = { passport: 'passport_path', certificate: 'certificate_path', certificate2: 'certificate2_path' }[req.params.image]
    const [rows] = await pool.execute(`SELECT ${column} AS filename FROM candidates WHERE id = ?`, [req.params.id])
    if (!rows.length) return res.status(404).json({ message: 'Image not found.' })
    const filename = rows[0].filename
    if (!/^[a-f0-9-]{36}\.jpg$/.test(filename)) return res.status(404).json({ message: 'Image not found.' })
    res.type('jpeg').set('Content-Disposition', `inline; filename="${req.params.image}.jpg"`)
    res.sendFile(path.join(config.uploadDir, filename), error => {
      if (req.aborted || res.destroyed || error?.code === 'ECONNABORTED') return
      if (error && !res.headersSent) { if (error.status === 404) return res.status(404).json({ message: 'Image file not found.' }); next(error) }
    })
  })
  return router
}

