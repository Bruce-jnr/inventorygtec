import { it } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import express from 'express'
import request from 'supertest'
import { MAX_SAVED_IMAGE_BYTES, saveImages, uploadMiddleware } from '../middleware/upload.js'

it('accepts originals over 3 MB and saves only compressed JPEGs under 3 MB', async () => {
  const original = await sharp(randomBytes(2000 * 2000 * 3), {
    raw: { width: 2000, height: 2000, channels: 3 },
  }).png().toBuffer()
  assert.ok(original.length > MAX_SAVED_IMAGE_BYTES)
  assert.ok(original.length < 15 * 1024 * 1024)
  const directory = await mkdtemp(path.join(os.tmpdir(), 'compressed-uploads-'))
  try {
    const app = express()
    app.post('/', uploadMiddleware(15 * 1024 * 1024), async (req, res) => {
      res.json(await saveImages(req.files, directory))
    })
    const response = await request(app).post('/')
      .attach('passport', original, 'passport.png')
      .attach('certificate', original, 'certificate.png')
      .attach('certificate2', original, 'certificate2.png').expect(200)
    assert.equal(response.body.length, 3)
    assert.equal((await readdir(directory)).length, 3)
    for (const filename of response.body) {
      const saved = await readFile(path.join(directory, filename))
      assert.ok(saved.length <= MAX_SAVED_IMAGE_BYTES)
      const metadata = await sharp(saved).metadata()
      assert.equal(metadata.format, 'jpeg')
      assert.ok(metadata.width <= 2400 && metadata.height <= 2400)
    }
  } finally {
    // This directory is created exclusively by this test.
    await rm(directory, { recursive: true, force: true })
  }
})
