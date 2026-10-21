import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

export const backendDir = path.dirname(fileURLToPath(import.meta.url))
export const projectDir = path.dirname(backendDir)
dotenv.config({ path: path.join(projectDir, '.env'), quiet: true })
export const config = {
  port: Number(process.env.PORT || 5000),
  production: process.env.NODE_ENV === 'production',
  serveFrontend: process.env.NODE_ENV === 'production',
  frontendDir: path.join(projectDir, 'frontend', 'dist'),
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  uploadDir: path.resolve(backendDir, process.env.UPLOAD_DIR || 'uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 15) * 1024 * 1024,
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
