import mysql from 'mysql2/promise'
import { readFile } from 'node:fs/promises'
import { config } from '../config.js'

let connection
try {
  connection = await mysql.createConnection({ ...config.db, database: undefined, multipleStatements: false })
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(config.db.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await connection.changeUser({ database: config.db.database })
  const schema = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8')
  for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) await connection.query(statement)
  console.log('Database and tables are ready.')
} catch (error) {
  console.error('Database setup failed. Check credentials and CREATE privileges. Error:', error.code || error.name)
  process.exitCode = 1
} finally { if (connection) await connection.end() }
