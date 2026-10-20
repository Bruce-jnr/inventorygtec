import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, access } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import mysql from 'mysql2/promise'
import request from 'supertest'
import sharp from 'sharp'
import { config } from '../config.js'
import { createApp } from '../app.js'

describe('Student retrieval and corrections', { concurrency: false }, () => {
  const database = `candidate_edit_test_${randomBytes(8).toString('hex')}`
  let connection, pool, directory, app, png, reference, id, student, secondTab, csrf, secondCsrf
  before(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'candidate-edit-'))
    connection = await mysql.createConnection({ ...config.db, database: undefined })
    await connection.query(`CREATE DATABASE ${mysql.escapeId(database)}`)
    pool = mysql.createPool({ ...config.db, database })
    const schema = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) await pool.query(statement)
    app = createApp({ pool, config: { ...config, production: false, uploadDir: directory } })
    png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#0052ff' } }).png().toBuffer()
    student = request.agent(app)
    secondTab = request.agent(app)
    const session = await student.get('/api/session').expect(200)
    csrf = session.body.csrfToken
    const result = await student.post('/api/candidates').set('X-CSRF-Token', csrf).set('Idempotency-Key', randomUUID())
      .field('surname', 'Mensah').field('first_name', 'Ama').field('admission_year', '2024').field('current_level', '200').field('mode_of_entry', 'Regular').field('date_of_birth', '2003-02-17')
      .attach('passport', png, 'passport.png').attach('certificate', png, 'certificate.png').expect(201)
    reference = result.body.reference
    id = result.body.candidateId
  })
  after(async () => {
    app?.locals.sessionStore.close()
    if (pool) await pool.end()
    if (connection) { await connection.query(`DROP DATABASE IF EXISTS ${mysql.escapeId(database)}`); await connection.end() }
    if (directory) await rm(directory, { recursive: true, force: true })
  })
  function update(agent, token, revision, options = {}) {
    return agent.put('/api/student/me').set('X-CSRF-Token', token).set('If-Match', String(revision))
      .field('surname', options.surname || 'Mensah').field('first_name', 'Ama').field('middle_name', 'Akua')
      .field('admission_year', '2024').field('current_level', '300').field('mode_of_entry', 'Matured').field('date_of_birth', options.dob || '2003-02-17')
      .field('remove_second_certificate', options.remove ? 'true' : 'false')
  }
  it('does not expose forms or images before verifying reference and DOB', async () => {
    await student.get('/api/student/me').expect(401)
    for (const kind of ['passport', 'certificate', 'certificate2']) await student.get(`/api/student/me/${kind}`).expect(401)
    await student.post('/api/student/access').send({ reference, date_of_birth: '2003-02-17' }).expect(403)
    await student.post('/api/student/access').set('X-CSRF-Token', csrf).send({ reference, date_of_birth: '2003-02-18' }).expect(403)
    await student.post('/api/student/access').set('X-CSRF-Token', csrf).send({ reference, date_of_birth: '2003-02-30' }).expect(400)
  })
  it('retrieves the student record without private paths and protects admin data', async () => {
    const result = await student.post('/api/student/access').set('X-CSRF-Token', csrf).send({ reference: reference.toLowerCase(), date_of_birth: '2003-02-17' }).expect(200)
    csrf = result.body.csrfToken
    assert.equal(result.body.candidate.reference, reference)
    assert.ok(!('passport_path' in result.body.candidate))
    await student.get('/api/student/me/passport').expect(200)
    await student.get('/api/student/me/certificate').expect(200)
    await student.get('/api/student/me/certificate2').expect(404)
    await student.get('/api/admin/candidates').expect(401)
    const otherSession = await secondTab.get('/api/session').expect(200)
    const second = await secondTab.post('/api/student/access').set('X-CSRF-Token', otherSession.body.csrfToken).send({ reference, date_of_birth: '2003-02-17' }).expect(200)
    secondCsrf = second.body.csrfToken
  })
  it('resubmits corrections without requiring existing images again or creating a new record', async () => {
    const result = await update(student, csrf, 0).expect(200)
    assert.equal(result.body.reference, reference)
    const [[row]] = await pool.execute('SELECT * FROM candidates WHERE id = ?', [id])
    assert.equal(row.current_level, '300')
    assert.equal(row.mode_of_entry, 'Matured')
    assert.equal(row.middle_name, 'AKUA')
    assert.equal(row.revision, 1)
    const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM candidates')
    assert.equal(Number(count.total), 1)
    assert.equal((await readdir(directory)).length, 2)
  })
  it('rejects stale edits and removes newly uploaded files after a conflict', async () => {
    await update(secondTab, secondCsrf, 0, { surname: 'Overwrite' }).attach('passport', png, 'passport.png').expect(409)
    const result = await student.get('/api/student/me').expect(200)
    assert.equal(result.body.surname, 'MENSAH')
    assert.equal((await readdir(directory)).length, 2)
  })
  it('adds a second certificate and rejects fake replacements without changing the record', async () => {
    await update(student, csrf, 1).attach('certificate2', png, 'second.png').expect(200)
    const result = await student.get('/api/student/me').expect(200)
    assert.equal(result.body.has_second_certificate, true)
    await student.get('/api/student/me/certificate2').expect(200)
    await update(student, csrf, 2).attach('passport', Buffer.from('fake image'), 'fake.png').expect(415)
    assert.equal((await readdir(directory)).length, 3)
  })
  it('replaces saved images, removes the second certificate and saves a corrected DOB', async () => {
    const [[old]] = await pool.execute('SELECT passport_path, certificate2_path FROM candidates WHERE id = ?', [id])
    await update(student, csrf, 2, { remove: true, dob: '2003-02-19' }).attach('passport', png, 'new.png').expect(200)
    await assert.rejects(access(path.join(directory, old.passport_path)))
    await assert.rejects(access(path.join(directory, old.certificate2_path)))
    const result = await student.get('/api/student/me').expect(200)
    assert.equal(result.body.date_of_birth, '2003-02-19')
    assert.equal(result.body.has_second_certificate, false)
    assert.equal((await readdir(directory)).length, 2)
  })
  it('closes edit access and requires the corrected DOB for future retrieval', async () => {
    await student.post('/api/student/end-access').set('X-CSRF-Token', csrf).send({}).expect(200)
    await student.get('/api/student/me').expect(401)
    await student.get('/api/student/me/passport').expect(401)
    await student.post('/api/student/access').set('X-CSRF-Token', csrf).send({ reference, date_of_birth: '2003-02-17' }).expect(403)
    const result = await student.post('/api/student/access').set('X-CSRF-Token', csrf).send({ reference, date_of_birth: '2003-02-19' }).expect(200)
    csrf = result.body.csrfToken
    const [sessions] = await pool.execute('SELECT session_id, data FROM sessions')
    for (const row of sessions) {
      const data = JSON.parse(row.data)
      if (data.student) { data.student.expiresAt = Date.now() - 1; await pool.execute('UPDATE sessions SET data = ? WHERE session_id = ?', [JSON.stringify(data), row.session_id]) }
    }
    await student.get('/api/student/me').expect(401)
    await update(student, csrf, 3).expect(401)
  })
})
