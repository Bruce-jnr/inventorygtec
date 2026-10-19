import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import mysql from 'mysql2/promise'
import bcrypt from 'bcrypt'
import request from 'supertest'
import sharp from 'sharp'
import { config } from '../config.js'
import { createApp } from '../app.js'

describe('Candidate API with isolated MySQL persistence', { concurrency: false }, () => {
  const database = `candidate_test_${randomBytes(8).toString('hex')}`
  const password = randomBytes(24).toString('hex')
  let connection, pool, app, directory, png, jpeg, candidate, anonymous, admin, csrf, adminCsrf, originalCookie
  const apps = []
  before(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'candidate-api-test-'))
    connection = await mysql.createConnection({ ...config.db, database: undefined })
    await connection.query(`CREATE DATABASE ${mysql.escapeId(database)}`)
    pool = mysql.createPool({ ...config.db, database })
    const schema = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8')
    for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) await pool.query(statement)
    await pool.execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['test-admin', await bcrypt.hash(password, 12)])
    png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#139885' } }).png().toBuffer()
    jpeg = await sharp(png).jpeg().toBuffer()
    app = createApp({ pool, config: { ...config, production: false, uploadDir: directory } })
    apps.push(app)
    anonymous = request.agent(app)
    admin = request.agent(app)
    const session = await anonymous.get('/api/session').expect(200)
    csrf = session.body.csrfToken
  })
  after(async () => {
    for (const instance of apps) instance.locals.sessionStore.close()
    if (pool) await pool.end()
    if (connection) { await connection.query(`DROP DATABASE IF EXISTS ${mysql.escapeId(database)}`); await connection.end() }
    // directory is created by mkdtemp above and is exclusively owned by this test.
    if (directory) await rm(directory, { recursive: true, force: true })
  })
  function registration(agent = anonymous, key = randomUUID(), token = csrf, values = {}) {
    return agent.post('/api/candidates').set('X-CSRF-Token', token).set('Idempotency-Key', key)
      .field('full_name', values.full_name ?? 'Ama Mensah').field('admission_year', '2024').field('current_level', '200').field('date_of_birth', '2003-02-17')
  }
  it('reports a healthy database and sets private cache headers', async () => {
    const response = await request(app).get('/api/health').expect(200)
    assert.equal(response.body.status, 'ok')
    assert.equal(response.headers['cache-control'], 'no-store')
  })
  it('blocks every private endpoint without authentication', async () => {
    for (const endpoint of ['/api/admin/stats', '/api/admin/candidates', '/api/admin/candidates/1', '/api/admin/candidates/1/passport', '/api/admin/candidates/1/certificate']) await anonymous.get(endpoint).expect(401)
    await anonymous.get('/uploads/example.jpg').expect(404)
  })
  it('requires a session CSRF token and checks request origins', async () => {
    await anonymous.post('/api/candidates').expect(403)
    await anonymous.post('/api/admin/login').set('X-CSRF-Token', csrf).set('Origin', 'https://untrusted.example').send({ username: 'test-admin', password }).expect(403)
  })
  it('returns field validation errors and writes no files for missing data', async () => {
    const response = await anonymous.post('/api/candidates').set('X-CSRF-Token', csrf).set('Idempotency-Key', randomUUID()).field('full_name', 'A').expect(400)
    assert.ok(response.body.errors.full_name)
    assert.ok(response.body.errors.passport)
    assert.deepEqual(await readdir(directory), [])
  })
  it('rejects fake images, MIME mismatches and unsupported file types', async () => {
    await registration().attach('passport', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' }).attach('certificate', png, 'certificate.png').expect(415)
    await registration().attach('passport', png, { filename: 'wrong.jpg', contentType: 'image/jpeg' }).attach('certificate', png, 'certificate.png').expect(415)
    await registration().attach('passport', Buffer.from('pdf'), { filename: 'file.pdf', contentType: 'application/pdf' }).attach('certificate', png, 'certificate.png').expect(415)
    await registration().attach('passport', Buffer.concat([png.subarray(0, 8), Buffer.from('corrupted')]), 'broken.png').attach('certificate', png, 'certificate.png').expect(415)
    assert.deepEqual(await readdir(directory), [])
  })
  it('rejects oversized uploads', async () => {
    await registration().attach('passport', Buffer.alloc(config.maxUploadBytes + 1), 'large.png').attach('certificate', png, 'certificate.png').expect(413)
    assert.deepEqual(await readdir(directory), [])
  })
  it('rejects impossible dates, invalid levels and empty requests', async () => {
    const result = await anonymous.post('/api/candidates').set('X-CSRF-Token', csrf).set('Idempotency-Key', randomUUID())
      .field('full_name', 'Ama Mensah').field('admission_year', '2024').field('current_level', 'invalid').field('date_of_birth', '2003-02-30')
      .attach('passport', png, 'passport.png').attach('certificate', png, 'certificate.png').expect(400)
    assert.ok(result.body.errors.current_level)
    assert.ok(result.body.errors.date_of_birth)
    await anonymous.post('/api/candidates').set('X-CSRF-Token', csrf).set('Idempotency-Key', randomUUID()).expect(400)
    assert.deepEqual(await readdir(directory), [])
  })
  it('registers both image types, persists data and normalizes private files', async () => {
    const response = await registration().attach('passport', jpeg, 'passport.jpg').attach('certificate', png, 'certificate.png').expect(201)
    candidate = response.body
    assert.match(candidate.reference, /^CAN-\d{4}-[A-F0-9]{16}$/)
    const [[row]] = await pool.execute('SELECT * FROM candidates WHERE id = ?', [candidate.candidateId])
    assert.equal(row.full_name, 'Ama Mensah')
    assert.equal(row.date_of_birth, '2003-02-17')
    assert.match(row.passport_path, /^[a-f0-9-]{36}\.jpg$/)
    assert.equal((await readdir(directory)).length, 2)
    assert.equal((await sharp(await readFile(path.join(directory, row.certificate_path))).metadata()).format, 'jpeg')
  })
  it('makes retries idempotent without creating duplicate records or files', async () => {
    const [[row]] = await pool.execute('SELECT request_key FROM candidates WHERE id = ?', [candidate.candidateId])
    const response = await registration(anonymous, row.request_key).attach('passport', png, 'passport.png').attach('certificate', png, 'certificate.png').expect(201)
    assert.equal(String(response.body.candidateId), String(candidate.candidateId))
    assert.equal(response.body.reference, candidate.reference)
    assert.equal((await readdir(directory)).length, 2)
  })
  it('cleans up files if database insertion fails', async () => {
    const failingPool = { execute(sql, params) { if (sql.startsWith('INSERT INTO candidates')) return Promise.reject(Object.assign(new Error('test database failure'), { code: 'TEST_FAILURE' })); return pool.execute(sql, params) } }
    const failedApp = createApp({ pool: failingPool, config: { ...config, production: false, uploadDir: directory } })
    apps.push(failedApp)
    const agent = request.agent(failedApp)
    const session = await agent.get('/api/session').expect(200)
    const result = await registration(agent, randomUUID(), session.body.csrfToken).attach('passport', png, 'passport.png').attach('certificate', png, 'certificate.png').expect(500)
    assert.ok(!JSON.stringify(result.body).includes('TEST_FAILURE'))
    assert.equal((await readdir(directory)).length, 2)
  })
  it('logs in securely, regenerates sessions and rejects invalid credentials', async () => {
    const session = await admin.get('/api/session').expect(200)
    originalCookie = session.headers['set-cookie'][0]
    await admin.post('/api/admin/login').set('X-CSRF-Token', session.body.csrfToken).send({ username: 'test-admin', password: 'incorrect-password' }).expect(401)
    const result = await admin.post('/api/admin/login').set('X-CSRF-Token', session.body.csrfToken).send({ username: 'test-admin', password }).expect(200)
    adminCsrf = result.body.csrfToken
    assert.notEqual(adminCsrf, session.body.csrfToken)
    assert.notEqual(result.headers['set-cookie'][0].split(';')[0], originalCookie.split(';')[0])
    assert.match(result.headers['set-cookie'][0], /HttpOnly/)
    assert.match(result.headers['set-cookie'][0], /SameSite=Lax/)
    assert.equal(result.body.admin.username, 'test-admin')
  })
  it('searches, filters, paginates and returns stats without storage paths', async () => {
    const [[row]] = await pool.execute('SELECT passport_path, certificate_path FROM candidates WHERE id = ?', [candidate.candidateId])
    for (let index = 0; index < 11; index++) await pool.execute('INSERT INTO candidates (reference, request_key, full_name, admission_year, current_level, date_of_birth, passport_path, certificate_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [`TEST-${index}`, randomUUID(), `Test Candidate ${index}`, 2023, '300', '2002-01-01', row.passport_path, row.certificate_path])
    const list = await admin.get('/api/admin/candidates').expect(200)
    assert.equal(list.body.total, 12)
    assert.equal(list.body.candidates.length, 10)
    assert.ok(!JSON.stringify(list.body).includes('passport_path'))
    const second = await admin.get('/api/admin/candidates?page=2').expect(200)
    assert.equal(second.body.candidates.length, 2)
    const filtered = await admin.get('/api/admin/candidates?search=Ama&year=2024&level=200').expect(200)
    assert.equal(filtered.body.total, 1)
    const injection = await admin.get('/api/admin/candidates').query({ search: "%' OR 1=1 --" }).expect(200)
    assert.equal(injection.body.total, 0)
    await admin.get('/api/admin/candidates?page=-1').expect(400)
    const stats = await admin.get('/api/admin/stats').expect(200)
    assert.equal(stats.body.total, 12)
    assert.equal(stats.body.admissionYears, 2)
  })
  it('returns details and authenticated images with safe headers', async () => {
    const detail = await admin.get(`/api/admin/candidates/${candidate.candidateId}`).expect(200)
    assert.equal(detail.body.full_name, 'Ama Mensah')
    assert.ok(!('certificate_path' in detail.body))
    for (const image of ['passport', 'certificate']) {
      const result = await admin.get(`/api/admin/candidates/${candidate.candidateId}/${image}`).expect(200)
      assert.match(result.headers['content-type'], /image\/jpeg/)
      assert.equal(result.headers['x-content-type-options'], 'nosniff')
      assert.equal(result.headers['cache-control'], 'no-store')
    }
    await admin.get('/api/admin/candidates/999999').expect(404)
    await admin.get(`/api/admin/candidates/${candidate.candidateId}/unknown`).expect(404)
  })
  it('never resolves database image paths outside private storage', async () => {
    const [[row]] = await pool.execute('SELECT passport_path FROM candidates WHERE id = ?', [candidate.candidateId])
    try {
      await pool.execute('UPDATE candidates SET passport_path = ? WHERE id = ?', ['../../.env', candidate.candidateId])
      await admin.get(`/api/admin/candidates/${candidate.candidateId}/passport`).expect(404)
    } finally { await pool.execute('UPDATE candidates SET passport_path = ? WHERE id = ?', [row.passport_path, candidate.candidateId]) }
  })
  it('invalidates the session on logout, including previously issued cookies', async () => {
    const beforeLogout = await admin.get('/api/session').expect(200)
    const cookie = beforeLogout.headers['set-cookie']?.[0]
    await admin.post('/api/admin/logout').set('X-CSRF-Token', adminCsrf).send({}).expect(200)
    await admin.get('/api/admin/candidates').expect(401)
    if (cookie) await request(app).get('/api/admin/candidates').set('Cookie', cookie.split(';')[0]).expect(401)
  })
  it('rejects expired authentication even if the cookie still exists', async () => {
    const session = await admin.get('/api/session').expect(200)
    await admin.post('/api/admin/login').set('X-CSRF-Token', session.body.csrfToken).send({ username: 'test-admin', password }).expect(200)
    const [rows] = await pool.execute('SELECT session_id, data FROM sessions')
    for (const row of rows) {
      const stored = JSON.parse(row.data)
      if (stored.admin) {
        stored.authExpiresAt = Date.now() - 1
        await pool.execute('UPDATE sessions SET data = ? WHERE session_id = ?', [JSON.stringify(stored), row.session_id])
      }
    }
    await admin.get('/api/admin/candidates').expect(401)
    const expired = await admin.get('/api/session').expect(200)
    assert.equal(expired.body.admin, null)
  })
  it('rate-limits registrations and returns safe JSON parsing errors', async () => {
    const limitedApp = createApp({ pool, config: { ...config, production: false, uploadDir: directory } })
    apps.push(limitedApp)
    const agent = request.agent(limitedApp)
    const session = await agent.get('/api/session').expect(200)
    for (let attempt = 0; attempt < 15; attempt++) await agent.post('/api/candidates').set('X-CSRF-Token', session.body.csrfToken).expect(400)
    const limited = await agent.post('/api/candidates').set('X-CSRF-Token', session.body.csrfToken).expect(429)
    assert.match(limited.body.message, /Too many registrations/)
    const malformed = await agent.post('/api/admin/login').set('Content-Type', 'application/json').send('{broken-json').expect(400)
    assert.equal(malformed.body.message, 'Send a valid JSON request.')
  })
  it('uses Secure cookies behind the configured production HTTPS proxy', async () => {
    const productionApp = createApp({ pool, config: { ...config, production: true, uploadDir: directory } })
    apps.push(productionApp)
    const response = await request(productionApp).get('/api/session').set('X-Forwarded-Proto', 'https').expect(200)
    assert.match(response.headers['set-cookie'][0], /; Secure/)
    assert.match(response.headers['set-cookie'][0], /; HttpOnly/)
  })
})
