import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import session from 'express-session'
import request from 'supertest'
import { createApp } from '../app.js'
import { config, projectDir } from '../config.js'

describe('Production frontend hosting', () => {
  let directory, app
  before(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'student-hosting-'))
    await mkdir(path.join(directory, 'assets'))
    await writeFile(path.join(directory, 'index.html'), '<!doctype html><html><title>Student Inventory</title><body><div id="root"></div></body></html>')
    await writeFile(path.join(directory, 'assets', 'app.js'), 'console.log("Student Inventory")')
    app = createApp({ pool: { execute: async () => [[{ healthy: 1 }]] }, store: new session.MemoryStore(), config: { ...config, production: true, serveFrontend: true, frontendDir: directory } })
  })
  after(async () => { if (directory) await rm(directory, { recursive: true, force: true }) })
  it('serves the build and React deep links from the same server', async () => {
    for (const route of ['/', '/admin/login', '/retrieve', '/admin/candidates/1/print']) {
      const response = await request(app).get(route).expect(200)
      assert.match(response.headers['content-type'], /text\/html/)
      assert.match(response.text, /Student Inventory/)
    }
    await request(app).get('/assets/app.js').expect(200)
  })
  it('does not serve source files, secrets or uploads, and keeps API 404s as JSON', async () => {
    for (const route of ['/.env', '/backend/config.js', '/uploads/test.jpg', '/assets/missing.js']) await request(app).get(route).expect(404)
    const response = await request(app).get('/api/not-found').expect(404)
    assert.match(response.headers['content-type'], /application\/json/)
    await request(app).get('/api/health').expect(200)
  })
  it('allows private blob images and Inter fonts under production CSP', async () => {
    const response = await request(app).get('/').expect(200)
    assert.match(response.headers['content-security-policy'], /img-src[^;]*blob:/)
    assert.match(response.headers['content-security-policy'], /font-src[^;]*fonts.gstatic.com/)
  })
  it('resolves the frontend build relative to the root startup directory', () => {
    assert.equal(config.frontendDir, path.join(projectDir, 'frontend', 'dist'))
  })
})
