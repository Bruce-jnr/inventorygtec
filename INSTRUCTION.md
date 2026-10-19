# Candidate Registration and Management System — INSTRUCTION.md

## 1. Project goal
Build a secure, responsive web application where candidates submit their details and supporting images, and authorized administrators review, search, and print candidate records with passport photographs.

**Technology:** React (Vite), Node.js, Express, MySQL, and Multer.

## 2. Required features

### Candidate portal
- Public registration form with required fields: full name, year of admission, current level, date of birth, passport photo, and certificate image.
- Accept **JPEG/JPG or PNG** for both uploads; show previews and size guidance.
- Validate inputs on both frontend and backend.
- Submit form as `multipart/form-data` and show a success message with a unique registration reference.
- Prevent accidental double submissions.

### Admin portal
- Secure admin login and logout.
- Dashboard with total registrations and candidate list.
- Search/filter by name, admission year, and level; paginate results.
- Open a candidate record to view all fields, passport, and certificate.
- Print an individual candidate record with passport photo in an A4-friendly layout; optionally include the certificate.
- Ensure only authenticated admins can view or download private candidate data and images.

## 3. Recommended folder structure

```text
candidate-system/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── CandidateForm.jsx
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── CandidateDetails.jsx
│   │   │   └── CandidatePrint.jsx
│   │   ├── components/
│   │   ├── api/client.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── .env.example
├── backend/
│   ├── routes/
│   │   ├── candidateRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── uploads/              # private, not publicly served
│   ├── db.js
│   ├── server.js
│   └── .env.example
├── database/schema.sql
├── .gitignore
└── INSTRUCTION.md
```

## 4. Prerequisites
- Node.js LTS and npm
- MySQL 8 or compatible MySQL server
- VS Code or another editor
- Git (recommended)

## 5. Initial setup

From a terminal:

```bash
mkdir candidate-system
cd candidate-system
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install axios react-router-dom lucide-react
cd ..
mkdir backend
cd backend
npm init -y
npm install express mysql2 cors dotenv multer bcrypt jsonwebtoken helmet express-rate-limit
npm install -D nodemon
cd ..
mkdir database
```

Create `backend/uploads` before testing uploads, and ensure the backend process has permission to write to it. Do not commit uploaded files.

## 6. Database schema

Save as `database/schema.sql`:

```sql
CREATE DATABASE IF NOT EXISTS candidate_system
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE candidate_system;

CREATE TABLE IF NOT EXISTS candidates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  admission_year YEAR NOT NULL,
  current_level VARCHAR(30) NOT NULL,
  date_of_birth DATE NOT NULL,
  passport_path VARCHAR(255) NOT NULL,
  certificate_path VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_candidate_name (full_name),
  INDEX idx_admission_year (admission_year),
  INDEX idx_level (current_level)
);

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Import this schema with a MySQL client. Create the initial administrator with a one-time setup script that hashes the password with bcrypt; never store plaintext passwords or hardcode credentials.

## 7. Backend configuration

Create `backend/.env` from the following example:

```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=candidate_app
DB_PASSWORD=replace_with_secure_password
DB_NAME=candidate_system
JWT_SECRET=replace_with_a_long_random_secret
FRONTEND_ORIGIN=http://localhost:5173
UPLOAD_DIR=./uploads
```

Use a dedicated MySQL account with only the permissions required by the application. Keep `.env` out of Git. Configure CORS for the actual frontend origin, not `*` for authenticated requests.

Implement `db.js` with `mysql2/promise` and a connection pool. Use prepared/parameterized SQL queries throughout.

## 8. Backend API contract

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/candidates` | Public | Submit candidate form and two images |
| POST | `/api/admin/login` | Public, rate-limited | Authenticate admin |
| POST | `/api/admin/logout` | Admin | End session (if using cookie sessions) |
| GET | `/api/admin/candidates` | Admin | Paginated/searchable list |
| GET | `/api/admin/candidates/:id` | Admin | Full candidate record |
| GET | `/api/admin/candidates/:id/passport` | Admin | Protected passport image |
| GET | `/api/admin/candidates/:id/certificate` | Admin | Protected certificate image |
| GET | `/api/admin/stats` | Admin | Dashboard summary |

### Registration request
Send `multipart/form-data` with these exact field names:

```text
full_name
admission_year
current_level
date_of_birth
passport
certificate
```

Successful response (HTTP 201):

```json
{"message":"Registration successful","candidateId":123}
```

Return appropriate 400/401/403/413/415/429/500 errors with safe messages. Never include stack traces or database credentials in API responses.

## 9. File upload rules
- Accept only JPEG and PNG images, with a configurable maximum size (initially 3 MB each).
- Validate MIME type **and file signature/content**, not only filename extension or browser-provided MIME type.
- Use randomly generated filenames (e.g. UUID), and never trust original filenames as storage paths.
- Store files outside any publicly served static directory. Do **not** use `express.static` to expose private uploads.
- Protect image endpoints with admin authentication and verify record ownership/path resolution.
- Remove files if validation or database insertion fails; handle orphaned files.
- Set secure response headers and disable content sniffing.
- Consider resizing/normalizing passport images after validation.

## 10. Frontend requirements
- Build pages using React Router.
- Use controlled form inputs and `FormData` for uploads.
- Restrict file picker to `accept="image/jpeg,image/png"` but also enforce server-side checks.
- Display validation errors near fields and submission status clearly.
- Set API base URL through `VITE_API_BASE_URL` (example: `http://localhost:5000`).
- Keep admin screens behind an authentication check; backend authorization is mandatory even if frontend routes are protected.
- For private images, fetch through authorized endpoints and display temporary blob URLs, revoking them after use.

## 11. Admin authentication
- Hash admin passwords using bcrypt.
- Use a well-designed session strategy: preferably secure, HttpOnly, SameSite cookies with CSRF protections where appropriate; if JWT is chosen, use short lifetimes and a safe token storage strategy.
- Apply rate limits to login and registration endpoints.
- Verify authentication and authorization on **every** admin endpoint, including images.
- Provide logout and appropriate session expiry.
- Never put a secret or database credential in frontend code.

## 12. Printing
- Add a `CandidatePrint` view showing: candidate reference, name, admission year, level, date of birth, and the actual passport image.
- Optionally show the certificate image on a separate print page.
- Use `window.print()` with `@media print` and `@page { size: A4; margin: 15mm; }`.
- Hide navigation, action buttons, and unnecessary dashboard UI in print mode.
- Ensure image loading completes before printing; test on Chrome and Edge.

## 13. Local development

Start MySQL and import the schema. Then:

**Backend:**
```bash
cd backend
node server.js
```

**Frontend (separate terminal):**
```bash
cd frontend
npm run dev
```

Open the URL displayed by Vite (normally `http://localhost:5173`). Confirm the API is listening on port 5000.

## 14. Implementation sequence
1. Create database and test MySQL connection.
2. Build Express server, validation, upload middleware, and registration API.
3. Build React candidate form and test actual uploads.
4. Add admin creation script, login, authentication middleware, and logout.
5. Add protected candidate listing, search, details, and image endpoints.
6. Build admin dashboard and candidate detail screen.
7. Build A4 print view with passport image.
8. Add error handling, cleanup, logging, privacy safeguards, and automated tests.
9. Deploy frontend, backend, MySQL, and persistent private file storage.

## 15. Acceptance tests
- [ ] Candidate cannot submit with missing fields.
- [ ] Valid JPG/PNG passport and certificate upload successfully.
- [ ] Fake images, unsupported file types, and oversized uploads are rejected.
- [ ] Candidate record and image paths are saved correctly in MySQL.
- [ ] Success response contains a registration reference.
- [ ] Unauthorized requests cannot list records or access either image.
- [ ] Admin can log in, search, filter, and view candidate details.
- [ ] Print preview includes the correct candidate and passport image.
- [ ] A4 print hides navigation and does not clip content.
- [ ] Upload errors do not leave orphaned files.
- [ ] Passwords and secrets never appear in logs or client bundles.
- [ ] Data is retained and backed up according to an explicit policy.

## 16. Deployment notes
For **cPanel**, confirm that the hosting plan supports a persistent Node.js/Express application, MySQL, HTTPS, and writable persistent private storage. Build React with `npm run build` and serve its `dist` output through the host's web server. Route `/api` requests to Express using the hosting platform's supported proxy/application configuration.

For a **VPS**, use Nginx or another reverse proxy for HTTPS and React static assets; run Express under a process manager/service and secure MySQL. Use managed or backed-up storage for uploaded files. Do not depend on temporary filesystem storage in serverless environments.

## 17. Definition of done
The application is complete when candidates can register with both images; data persists in MySQL; authorized admins can securely sign in, search and inspect records; and each record prints cleanly with its passport photograph. Test all security and validation requirements before accepting real personal information.
