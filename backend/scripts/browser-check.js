import { chromium, expect } from '@playwright/test'
import { createServer } from '../../frontend/node_modules/vite/dist/node/index.js'
import express from 'express'
import mysql from 'mysql2/promise'
import sharp from 'sharp'
import bcrypt from 'bcrypt'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { config } from '../config.js'
import { createApp } from '../app.js'

const database = `candidate_browser_${randomBytes(8).toString('hex')}`
const password = randomBytes(24).toString('hex')
const frontend = fileURLToPath(new URL('../../frontend/', import.meta.url))
const artifacts = fileURLToPath(new URL('../../artifacts/', import.meta.url))
let connection, pool, directory, vite, server, api, browser
try {
  directory = await mkdtemp(path.join(os.tmpdir(), 'candidate-browser-'))
  await mkdir(artifacts, { recursive: true })
  connection = await mysql.createConnection({ ...config.db, database: undefined })
  await connection.query(`CREATE DATABASE ${mysql.escapeId(database)}`)
  pool = mysql.createPool({ ...config.db, database })
  const schema = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8')
  for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) await pool.query(statement)
  await pool.execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['browser-admin', await bcrypt.hash(password, 12)])
  const image = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#139885' } }).png().toBuffer()
  const outer = express()
  outer.use((req, res, next) => req.path.startsWith('/api/') ? api(req, res, next) : next())
  vite = await createServer({ root: frontend, configFile: path.join(frontend, 'vite.config.js'), server: { middlewareMode: true, hmr: false }, logLevel: 'error' })
  outer.use(vite.middlewares)
  server = await new Promise(resolve => { const listener = outer.listen(0, 'localhost', () => resolve(listener)) })
  const origin = `http://localhost:${server.address().port}`
  api = createApp({ pool, config: { ...config, production: false, origin, uploadDir: directory } })
  for (const channel of ['chrome', 'msedge']) {
    browser = await chromium.launch({ channel, headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin)
    await expect(page.getByRole('heading', { name: 'Candidate registration', exact: true })).toBeVisible()
    await page.screenshot({ path: path.join(artifacts, `${channel}-registration-desktop.png`), fullPage: true })
    await page.getByRole('button', { name: 'Submit registration' }).click()
    await expect(page.getByRole('alert')).toContainText('highlighted fields')
    await expect(page.locator('#full_name-error')).toContainText('Enter your full name')
    await page.getByLabel('Full name', { exact: false }).fill(`Ama Browser ${channel}`)
    await page.getByLabel('Year of admission').selectOption('2024')
    await page.getByLabel('Current level').selectOption('200')
    await page.getByLabel('Date of birth').fill('2003-02-17')
    await page.locator('#passport').setInputFiles({ name: 'passport.png', mimeType: 'image/png', buffer: image })
    await page.locator('#certificate').setInputFiles({ name: 'certificate.png', mimeType: 'image/png', buffer: image })
    await expect(page.getByAltText('Passport photograph preview')).toBeVisible()
    await expect(page.getByAltText('Certificate image preview')).toBeVisible()
    await page.getByRole('button', { name: 'Submit registration' }).click()
    await expect(page.getByRole('heading', { name: 'You’re all registered.' })).toBeVisible()
    const reference = await page.locator('.reference-box strong').textContent()
    expect(reference).toMatch(/^CAN-/)
    await page.getByRole('link', { name: 'Admin portal' }).click()
    await page.screenshot({ path: path.join(artifacts, `${channel}-admin-login.png`), fullPage: true })
    await page.getByLabel('Username').fill('browser-admin')
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Candidate overview.' })).toBeVisible()
    await page.getByLabel('Search candidates by name').fill(`Ama Browser ${channel}`)
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.locator('tbody')).toContainText(reference)
    await page.getByLabel('Filter by admission year').selectOption('2024')
    await page.getByLabel('Filter by current level').selectOption('200')
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await page.screenshot({ path: path.join(artifacts, `${channel}-dashboard.png`), fullPage: true })
    await page.setViewportSize({ width: 375, height: 900 })
    const mobileOverflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(node => {
      const rect = node.getBoundingClientRect()
      return rect.right > window.innerWidth + 1 && getComputedStyle(node).position !== 'absolute' && !node.closest('.table-scroll')
    }).map(node => `${node.tagName}.${node.className}: ${Math.round(node.getBoundingClientRect().width)}px`))
    expect(mobileOverflow).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false')
    await page.screenshot({ path: path.join(artifacts, `${channel}-dashboard-mobile.png`), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.getByRole('link', { name: `View Ama Browser ${channel}` }).click()
    await expect(page.getByAltText(`Passport photograph of Ama Browser ${channel}`)).toBeVisible()
    await expect(page.getByAltText(`Certificate submitted by Ama Browser ${channel}`)).toBeVisible()
    await page.screenshot({ path: path.join(artifacts, `${channel}-candidate-details.png`), fullPage: true })
    await page.getByRole('link', { name: 'Print record' }).click()
    await expect(page.getByRole('button', { name: 'Print record' })).toBeEnabled()
    await expect(page.locator('.candidate-sheet')).toContainText(reference)
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.site-header')).toBeHidden()
    await expect(page.locator('.site-footer')).toBeHidden()
    const pdf = await page.pdf({ path: path.join(artifacts, `${channel}-candidate-a4.pdf`), preferCSSPageSize: true, printBackground: true })
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBe(1)
    await page.emulateMedia({ media: 'screen' })
    await page.getByLabel('Include certificate on a separate page').check()
    await expect(page.getByRole('button', { name: 'Print record' })).toBeEnabled()
    const certificatePdf = await page.pdf({ path: path.join(artifacts, `${channel}-candidate-with-certificate.pdf`), preferCSSPageSize: true, printBackground: true })
    expect((certificatePdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBe(2)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await page.goto(`${origin}/admin`)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await page.goto(origin)
    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.getByRole('button', { name: 'Submit registration' })).toBeVisible()
      if (width < 768) {
        await page.getByRole('button', { name: 'Open navigation' }).click()
        await expect(page.getByRole('link', { name: 'Registration', exact: true })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false')
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: path.join(artifacts, `${channel}-registration-${width}.png`), fullPage: true })
    }
    expect(errors).toEqual([])
    console.log(`${channel}: registration, image previews, login, filters, details, protected routes, logout, mobile layout and 1/2-page A4 PDFs passed.`)
    await browser.close()
    browser = null
  }
} catch (error) {
  console.error('Browser check failed:', error.message)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (vite) await vite.close()
  if (server) await new Promise(resolve => server.close(resolve))
  if (api) api.locals.sessionStore.close()
  if (pool) await pool.end()
  if (connection) { await connection.query(`DROP DATABASE IF EXISTS ${mysql.escapeId(database)}`); await connection.end() }
  if (directory) await rm(directory, { recursive: true, force: true })
}
