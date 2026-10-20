-- Run with `npm run db:init` from the project root.
-- The setup script selects DB_NAME from backend/.env.
CREATE TABLE IF NOT EXISTS candidates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(40) NOT NULL UNIQUE,
  request_key CHAR(36) NOT NULL UNIQUE,
  full_name VARCHAR(200) NOT NULL,
  surname VARCHAR(50) NULL,
  first_name VARCHAR(50) NULL,
  middle_name VARCHAR(50) NULL,
  admission_year YEAR NOT NULL,
  current_level VARCHAR(30) NOT NULL,
  mode_of_entry VARCHAR(10) NULL,
  date_of_birth DATE NOT NULL,
  passport_path VARCHAR(255) NOT NULL,
  certificate_path VARCHAR(255) NOT NULL,
  certificate2_path VARCHAR(255) NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_candidate_name (full_name),
  INDEX idx_admission_year (admission_year),
  INDEX idx_level (current_level)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) PRIMARY KEY,
  expires_at BIGINT UNSIGNED NOT NULL,
  data MEDIUMTEXT NOT NULL,
  INDEX idx_session_expiry (expires_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
