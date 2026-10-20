# cPanel deployment

The startup file is **app.js at the project root**. It uses CommonJS for compatibility with Passenger and imports the existing backend. The private **.env is also at the project root**, alongside package.json. Existing environment variables configured by cPanel take precedence over .env values.

## Prepare locally

```sh
npm run setup
npm run build
```

Upload the root app.js and package.json, backend source/package files/lockfile, database/, and the built frontend/dist/ directory. Keep .env in the application root outside public_html; never put the whole source tree in a publicly served document root. Do not upload Windows node_modules. Native dependencies must install on the hosting server.

## Setup Node.js App

- Node.js version: **22.12+** (or a newer supported version).
- Application mode: **Production**.
- Application root: your project directory, for example studentinventory under your home directory.
- Application URL: the root of your domain or subdomain, for example https://students.example.com. Frontend routes and API URLs assume root deployment.
- Application startup file: **app.js**.

Use cPanel's **Run NPM Install** in the application root. The root postinstall script installs the backend dependencies automatically. The frontend build is already uploaded, so frontend development dependencies are unnecessary on the server. If a host disables lifecycle scripts, activate its displayed Node.js environment in Terminal and run `npm --prefix backend install` explicitly.

Create a MySQL database and user in cPanel and assign that user the necessary privileges. Edit the root .env using .env.example as a template:

```env
NODE_ENV=production
FRONTEND_ORIGIN=https://students.example.com
DB_HOST=localhost
DB_PORT=3306
DB_NAME=yourcpaneluser_database
DB_USER=yourcpaneluser_dbuser
DB_PASSWORD=your_database_password
SESSION_SECRET=your_random_secret_of_at_least_32_characters
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=3
```

Let cPanel supply PORT when it does so. Relative UPLOAD_DIR remains relative to backend/, so ./uploads means backend/uploads and existing stored images remain compatible. Keep that directory private, writable and persistent.

In Terminal, activate the Node.js environment shown in cPanel, change to the application root, then run:

```sh
npm run db:init
npm run admin:create
```

Existing database records and credentials are preserved. Schema setup adds missing tables/columns; it needs the appropriate schema privileges. If your account cannot create a database, create it in cPanel first.

Restart the application in cPanel. In production, this one process serves the built frontend, React route fallbacks, and /api. It only serves files from frontend/dist; .env, backend source and uploads are never exposed as static files. Sessions require HTTPS. Admin sign-in is /admin/login; students correct records at /retrieve. Check /api/health for database readiness.

After a frontend change, rebuild locally, upload the new frontend/dist and restart. For API/configuration changes, upload the changed source/root .env and restart. See OPERATIONS.md for backup, privacy and storage requirements.

Startup filename reference: https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/
