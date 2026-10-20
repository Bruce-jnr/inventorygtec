import { readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { pool } from '../db.js'
import { config } from '../config.js'

// Safe default: report only. Explicit deletion ignores files younger than 24 hours.
try {
  const [rows] = await pool.execute('SELECT passport_path, certificate_path, certificate2_path FROM candidates')
  const referenced = new Set(rows.flatMap(row => [row.passport_path, row.certificate_path, row.certificate2_path]).filter(Boolean))
  const files = await readdir(config.uploadDir).catch(error => { if (error.code === 'ENOENT') return []; throw error })
  let orphaned = 0
  let removed = 0
  for (const filename of files) {
    if (!/^[a-f0-9-]{36}\.jpg$/.test(filename) || referenced.has(filename)) continue
    const fullPath = path.join(config.uploadDir, filename)
    const info = await stat(fullPath)
    if (!info.isFile() || Date.now() - info.mtimeMs < 86400000) continue
    orphaned++
    if (process.argv.includes('--delete')) { await unlink(fullPath); removed++ }
  }
  let missing = 0
  for (const filename of referenced) if (!files.includes(filename)) missing++
  console.log(`Upload audit: ${orphaned} orphaned files older than 24 hours; ${missing} missing referenced files; ${removed} removed.`)
} catch (error) { console.error('Upload audit failed:', error.code || error.name); process.exitCode = 1 }
finally { await pool.end() }
