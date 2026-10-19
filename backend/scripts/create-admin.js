import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import bcrypt from 'bcrypt'
import { pool } from '../db.js'

let muted = false
const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback() } })
const prompt = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) })
try {
  const username = (process.env.ADMIN_USERNAME || await prompt.question('Admin username: ')).trim()
  process.stdout.write('Admin password (12–72 UTF-8 bytes; hidden): ')
  muted = true
  const password = process.env.ADMIN_PASSWORD || await prompt.question('')
  muted = false
  process.stdout.write('\n')
  if (!/^[a-zA-Z0-9_.@-]{3,100}$/.test(username)) throw new Error('Use 3–100 letters, numbers, dots, underscores, @ or hyphens for the username.')
  if (Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) throw new Error('Password must be between 12 and 72 UTF-8 bytes.')
  const hash = await bcrypt.hash(password, 12)
  await pool.execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, hash])
  console.log('Administrator created. You can now sign in at /admin/login.')
} catch (error) {
  console.error(error.code === 'ER_DUP_ENTRY' ? 'That administrator already exists.' : error.code ? `Admin setup failed (${error.code}).` : error.message)
  process.exitCode = 1
} finally { prompt.close(); await pool.end() }
