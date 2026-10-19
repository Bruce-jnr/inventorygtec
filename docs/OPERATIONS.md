# Operations

## Hosting

Use HTTPS with a Node.js process/service, MySQL 8, and persistent private file storage. Build the frontend with `npm run build`; serve `frontend/dist` with an SPA fallback to `index.html`. Proxy `/api` to the Express service before the SPA fallback. Do not expose `backend/`, `.env`, or the uploads directory through the public web server.

Set `NODE_ENV=production`, `FRONTEND_ORIGIN` to the exact public origin, and a strong `SESSION_SECRET` (at least 32 random characters). The existing `JWT_SECRET` is supported as a fallback for signing sessions; the app does not use JWTs or browser token storage. Use a dedicated database user. Database creation requires setup privileges; runtime access only needs SELECT/INSERT/UPDATE/DELETE on application tables. Configure the database server timezone to UTC.

Production assumes exactly one trusted reverse proxy. Adjust `trust proxy` in `backend/app.js` to match your deployment before using a different proxy topology. Cookies are Secure in production, HttpOnly and SameSite=Lax; mutating requests additionally require a session CSRF token and an allowed Origin. Admin authentication expires after one hour. Run multiple API instances only after replacing the in-memory rate-limit store with a shared store; sessions already use MySQL.

Set the reverse proxy request size limit slightly above twice `MAX_UPLOAD_MB` to allow the two images and multipart overhead. Application defaults are 3 MB per file, 25 million decoded pixels, and 2,400 pixels maximum output dimensions. Images are decoded, stripped of metadata and stored as JPEG. Keep MySQL and uploads on durable storage and monitor disk capacity.

`GET /api/health` checks database connectivity without revealing credentials. Logs contain error codes, not submitted forms, passwords or database connection details. Route API errors to restricted operational logs.

## File cleanup

Registration failures remove any files already written. A process crash can still leave an orphan. Run this audit daily from `backend/`:

```sh
npm run uploads:audit
```

It reports orphan files older than 24 hours and missing referenced images, without printing personal filenames. After reviewing the report, `npm run uploads:audit -- --delete` removes only unreferenced UUID images older than 24 hours. It never deletes candidate records. Investigate missing images and restore them from a consistent backup.

## Data retention and backups

Local development policy: use synthetic candidates only. Test scripts create isolated temporary databases and image directories, and delete their own fixtures when finished. Production records are never automatically deleted by this application. The institution must approve and publish its retention period, access contacts and deletion process before collecting real records; do not assume student records may be removed after an arbitrary interval.

Baseline production backup policy: an operator schedules an encrypted nightly backup of MySQL and the corresponding private uploads, retains 30 daily snapshots in access-controlled off-host storage, and verifies a restore at least quarterly. Suspend registration writes while taking a paired database/files snapshot, or use a coordinated storage snapshot, so image paths and files match. Store encryption keys separately. Do not restore old session rows; clear sessions so administrators must sign in again. Backup expiry must also respect the institution's approved retention and deletion policy.

Scheduling, storage credentials, retention approval and off-host backups are deployment responsibilities; they are not configured automatically by local setup.

## Administrator accounts

Create each administrator with `npm run admin:create` at the project root. Passwords are hashed with bcrypt at cost 12. The prompt hides password input and refuses passwords outside 12–72 UTF-8 bytes. Automated provisioning may pass `ADMIN_USERNAME` and `ADMIN_PASSWORD` through process environment variables; do not put passwords into shell arguments or committed files. No default accounts or credentials are provided.

To revoke an account immediately, remove it through an authorized database operation and invalidate its stored sessions. Do not hand-edit a plaintext password into the admins table.
