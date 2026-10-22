import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { rateLimit } from 'express-rate-limit'
import { validateCandidate } from '../validation.js'
import { uploadMiddleware, saveImages } from '../middleware/upload.js'

export function candidateRoutes(pool, config) {
  const router = Router()
  router.post('/', rateLimit({ windowMs: 60 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many registrations. Please try again in an hour.' } }), uploadMiddleware(config.maxUploadBytes), async (req, res) => {
    const { errors, value } = validateCandidate(req.body)
    for (const field of ['passport', 'certificate']) if (!req.files?.[field]?.length) errors[field] = `Upload your ${field === 'passport' ? 'passport photo' : 'certificate image'}.`
    const requestKey = req.get('Idempotency-Key') || ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) return res.status(400).json({ message: 'Invalid registration request. Refresh the page and try again.' })
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check the highlighted fields.', errors })
    const [existing] = await pool.execute('SELECT id, reference FROM candidates WHERE request_key = ?', [requestKey])
    if (existing.length) return res.status(201).json({ message: 'Registration successful', candidateId: existing[0].id, reference: existing[0].reference })
    const duplicateMessage = 'Duplicate registrations are not allowed. A registration with this name, date of birth and admission year already exists. Retrieve your form using your reference number and date of birth to make corrections.'
    const identity = [value.full_name, value.date_of_birth, value.admission_year]
    const [matching] = await pool.execute('SELECT id FROM candidates WHERE full_name = ? AND date_of_birth = ? AND admission_year = ? LIMIT 1', identity)
    if (matching.length) return res.status(409).json({ message: duplicateMessage })
    const names = await saveImages(req.files, config.uploadDir)
    try {
      const reference = `CAN-${new Date().getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`
      const [result] = await pool.execute('INSERT INTO candidates (reference, request_key, full_name, surname, first_name, middle_name, admission_year, current_level, mode_of_entry, date_of_birth, passport_path, certificate_path, certificate2_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [reference, requestKey, value.full_name, value.surname, value.first_name, value.middle_name || null, value.admission_year, value.current_level, value.mode_of_entry, value.date_of_birth, names[0], names[1], names[2] || null])
      return res.status(201).json({ message: 'Registration successful', candidateId: result.insertId, reference })
    } catch (error) {
      await Promise.all(names.map(filename => unlink(path.join(config.uploadDir, filename)).catch(() => {})))
      if (error.code === 'ER_DUP_ENTRY') {
        const [duplicate] = await pool.execute('SELECT id, reference FROM candidates WHERE request_key = ?', [requestKey])
        if (duplicate.length) return res.status(201).json({ message: 'Registration successful', candidateId: duplicate[0].id, reference: duplicate[0].reference })
        const [matching] = await pool.execute('SELECT id FROM candidates WHERE full_name = ? AND date_of_birth = ? AND admission_year = ? LIMIT 1', identity)
        if (matching.length) return res.status(409).json({ message: duplicateMessage })
      }
      throw error
    }
  })
  return router
}
