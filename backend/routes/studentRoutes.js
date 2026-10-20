import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { rateLimit } from 'express-rate-limit'
import { validateCandidate } from '../validation.js'
import { uploadMiddleware, saveImages } from '../middleware/upload.js'

const fields = 'id, reference, surname, first_name, middle_name, full_name, admission_year, current_level, mode_of_entry, date_of_birth, revision, (certificate2_path IS NOT NULL) AS has_second_certificate'
const serialize = row => ({ ...row, has_second_certificate: Number(row.has_second_certificate) === 1 })
const images = { passport: 'passport_path', certificate: 'certificate_path', certificate2: 'certificate2_path' }

export function studentRoutes(pool, config) {
  const router = Router()
  router.post('/access', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many lookup attempts. Please try again in 15 minutes.' } }), async (req, res, next) => {
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim().toUpperCase() : ''
    const dob = req.body?.date_of_birth
    if (!/^CAN-\d{4}-[A-F0-9]{16}$/.test(reference) || typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return res.status(400).json({ message: 'Enter your registration reference and date of birth.' })
    const date = new Date(`${dob}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dob) return res.status(400).json({ message: 'Enter a valid date of birth.' })
    const [rows] = await pool.execute(`SELECT ${fields} FROM candidates WHERE reference = ? AND date_of_birth = ?`, [reference, dob])
    if (!rows.length) return res.status(403).json({ message: 'The reference and date of birth do not match a registration.' })
    const { admin, authExpiresAt } = req.session
    req.session.regenerate(error => {
      if (error) return next(error)
      if (admin) { req.session.admin = admin; req.session.authExpiresAt = authExpiresAt }
      req.session.student = { id: rows[0].id, expiresAt: Date.now() + 15 * 60 * 1000 }
      req.session.csrfToken = randomBytes(32).toString('hex')
      req.session.save(error => error ? next(error) : res.json({ candidate: serialize(rows[0]), csrfToken: req.session.csrfToken }))
    })
  })
  router.use((req, res, next) => {
    if (!req.session.student || req.session.student.expiresAt <= Date.now()) return res.status(401).json({ message: 'Your editing session expired. Retrieve your registration again to continue.' })
    next()
  })
  router.post('/end-access', (req, res, next) => {
    delete req.session.student
    req.session.save(error => error ? next(error) : res.json({ message: 'Editing session closed.' }))
  })
  router.get('/me', async (req, res) => {
    const [rows] = await pool.execute(`SELECT ${fields} FROM candidates WHERE id = ?`, [req.session.student.id])
    if (!rows.length) return res.status(404).json({ message: 'Registration not found.' })
    res.json(serialize(rows[0]))
  })
  router.get('/me/:image', async (req, res, next) => {
    const column = Object.hasOwn(images, req.params.image) ? images[req.params.image] : null
    if (!column) return res.status(404).json({ message: 'Image not found.' })
    const [rows] = await pool.execute(`SELECT ${column} AS filename FROM candidates WHERE id = ?`, [req.session.student.id])
    const filename = rows[0]?.filename
    if (!filename || !/^[a-f0-9-]{36}\.jpg$/.test(filename)) return res.status(404).json({ message: 'Image not found.' })
    res.type('jpeg')
    res.sendFile(path.join(config.uploadDir, filename), error => {
      if (req.aborted || res.destroyed || error?.code === 'ECONNABORTED') return
      if (error && !res.headersSent) { if (error.status === 404) return res.status(404).json({ message: 'Image not found.' }); next(error) }
    })
  })
  router.put('/me', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many updates. Please try again in 15 minutes.' } }), uploadMiddleware(config.maxUploadBytes), async (req, res) => {
    const { errors, value } = validateCandidate(req.body)
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check the highlighted fields.', errors })
    if (!/^\d{1,10}$/.test(req.get('If-Match') || '')) return res.status(400).json({ message: 'Retrieve the registration again before editing.' })
    if (!['true', 'false'].includes(req.body.remove_second_certificate)) return res.status(400).json({ message: 'Choose whether to keep the second certificate.' })
    const removeSecond = req.body.remove_second_certificate === 'true'
    if (removeSecond && req.files?.certificate2) return res.status(400).json({ message: 'Remove the second certificate or upload a replacement.' })
    const kinds = Object.keys(images).filter(kind => req.files?.[kind]?.length)
    const newFiles = await saveImages(req.files, config.uploadDir)
    const replacements = Object.fromEntries(kinds.map((kind, index) => [images[kind], newFiles[index]]))
    let connection
    let committed = false
    let oldFiles = []
    try {
      connection = await pool.getConnection()
      await connection.beginTransaction()
      const [rows] = await connection.execute('SELECT * FROM candidates WHERE id = ? FOR UPDATE', [req.session.student.id])
      const current = rows[0]
      if (!current) throw Object.assign(new Error('Registration not found.'), { status: 400 })
      if (Number(current.revision) !== Number(req.get('If-Match'))) throw Object.assign(new Error('This registration has changed. Retrieve it again before resubmitting.'), { status: 409 })
      const passport = replacements.passport_path || current.passport_path
      const certificate = replacements.certificate_path || current.certificate_path
      const certificate2 = removeSecond ? null : replacements.certificate2_path || current.certificate2_path
      await connection.execute('UPDATE candidates SET surname = ?, first_name = ?, middle_name = ?, full_name = ?, admission_year = ?, current_level = ?, mode_of_entry = ?, date_of_birth = ?, passport_path = ?, certificate_path = ?, certificate2_path = ?, revision = revision + 1 WHERE id = ?',
        [value.surname, value.first_name, value.middle_name || null, value.full_name, value.admission_year, value.current_level, value.mode_of_entry, value.date_of_birth, passport, certificate, certificate2, current.id])
      oldFiles = Object.values(images).filter(column => replacements[column] || (column === 'certificate2_path' && removeSecond)).map(column => current[column]).filter(Boolean)
      await connection.commit()
      committed = true
      await Promise.all(oldFiles.map(filename => /^[a-f0-9-]{36}\.jpg$/.test(filename) ? unlink(path.join(config.uploadDir, filename)).catch(() => {}) : undefined))
      res.json({ message: 'Corrections saved successfully', candidateId: current.id, reference: current.reference })
    } catch (error) {
      if (connection && !committed) await connection.rollback().catch(() => {})
      if (!committed) await Promise.all(newFiles.map(filename => unlink(path.join(config.uploadDir, filename)).catch(() => {})))
      throw error
    } finally { connection?.release() }
  })
  return router
}
