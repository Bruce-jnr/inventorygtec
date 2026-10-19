import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

export const backendDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true })
export const config = {
  port: Number(process.env.PORT || 5000),
  production: process.env.NODE_ENV === 'production',
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  uploadDir: path.resolve(backendDir, process.env.UPLOAD_DIR || 'uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 3) * 1024 * 1024,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'candidate_system',
    dateStrings: true,
    timezone: 'Z',
    connectionLimit: 10,
    supportBigNumbers: true,
    bigNumberStrings: true,
  },
}
