import mysql from 'mysql2/promise'
import { readFile } from 'node:fs/promises'
import { config } from '../config.js'

let connection
try {
  try {
    connection = await mysql.createConnection({ ...config.db, multipleStatements: false })
  } catch (error) {
    if (error.code !== 'ER_BAD_DB_ERROR') throw error
    connection = await mysql.createConnection({ ...config.db, database: undefined, multipleStatements: false })
    await connection.query(`CREATE DATABASE ${mysql.escapeId(config.db.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await connection.changeUser({ database: config.db.database })
  }
  const schema = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8')
  for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) await connection.query(statement)
  const [columns] = await connection.query('SHOW COLUMNS FROM candidates')
  for (const field of ['surname', 'first_name', 'middle_name']) {
    if (!columns.some(column => column.Field === field)) await connection.query(`ALTER TABLE candidates ADD COLUMN ${mysql.escapeId(field)} VARCHAR(50) NULL`)
  }
  const fullName = columns.find(column => column.Field === 'full_name')
  if (!columns.some(column => column.Field === 'revision')) await connection.query('ALTER TABLE candidates ADD COLUMN revision INT UNSIGNED NOT NULL DEFAULT 0')
  if (!columns.some(column => column.Field === 'mode_of_entry')) await connection.query('ALTER TABLE candidates ADD COLUMN mode_of_entry VARCHAR(10) NULL')
  if (!columns.some(column => column.Field === 'certificate2_path')) await connection.query('ALTER TABLE candidates ADD COLUMN certificate2_path VARCHAR(255) NULL')
  if (fullName?.Type === 'varchar(150)') await connection.query('ALTER TABLE candidates MODIFY COLUMN full_name VARCHAR(200) NOT NULL')
  console.log('Database and tables are ready.')
} catch (error) {
  console.error('Database setup failed. Check credentials and CREATE privileges. Error:', error.code || error.name)
  process.exitCode = 1
} finally { if (connection) await connection.end() }

