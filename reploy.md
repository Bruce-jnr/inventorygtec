# cPanel deployment: remaining steps

Git code is already pulled and the Node.js application is already created.

## 1. Check Node.js settings

- Node.js: **22.12 or newer**
- Mode: **Production**
- Application root: your project folder
- Application startup file: **app.js**
- Application URL: your HTTPS domain/subdomain at `/`

## 2. Activate the Node.js environment

Open cPanel Terminal and paste the activation command shown in **Setup Node.js App**. Then enter your application folder:

```sh
cd /home/YOUR_CPANEL_USERNAME/studentinventory
```

Replace the path with your actual application root.

## 3. Configure the database

In **cPanel → MySQL Databases**:

1. Create the database and database user if missing.
2. Add the user to the database.
3. Grant **ALL PRIVILEGES** for initial setup.
4. Note the complete database and username, including cPanel prefixes.

## 4. Configure root .env

Create `.env` beside `app.js` using `.env.example`. If it already exists, edit it without overwriting your existing credentials.

```env
NODE_ENV=production
FRONTEND_ORIGIN=https://YOUR_DOMAIN
DB_HOST=localhost
DB_PORT=3306
DB_NAME=YOUR_CPANEL_PREFIX_database
DB_USER=YOUR_CPANEL_PREFIX_dbuser
DB_PASSWORD="YOUR_DATABASE_USER_PASSWORD"
SESSION_SECRET=YOUR_LONG_RANDOM_SECRET
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=15
```

Use your provider's database host if it differs. Omit `PORT` unless your host requires it.

Generate `SESSION_SECRET` if you do not already have one:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

In **Setup Node.js App → Environment variables**, remove or correct conflicting `DB_*`, `NODE_ENV`, and `FRONTEND_ORIGIN` values. These override `.env`.

## 5. Install dependencies

In the activated terminal, change to the actual application root, not the Node virtual environment directory:

```sh
cd /home/YOUR_CPANEL_USERNAME/studentinventory
npm --prefix "$PWD/backend" install --omit=dev
npm --prefix "$PWD/frontend" ci --include=dev
```

## 6. Build the frontend

```sh
npm run build
```

Leave `VITE_API_BASE_URL` unset or empty. Confirm `frontend/dist/index.html` exists after building.

## 7. Set permissions and initialize tables

```sh
chmod 600 .env
mkdir -p backend/uploads
chmod 700 backend/uploads
npm run db:init
```

If you get **ER_ACCESS_DENIED_ERROR**, correct the database username/password and user assignment in steps 3–4, then rerun `npm run db:init`.

## 8. Create an administrator

Only if an administrator does not already exist:

```sh
npm run admin:create
```

Enter your chosen username and a password of 12–72 UTF-8 bytes.

## 9. Restart

In **Setup Node.js App**, click **Restart**.

## 10. Check the application

- `/api/health` → `{"status":"ok"}`
- `/` → student registration
- `/retrieve` → retrieve/correct a form
- `/admin/login` → admin login
- `/.env` → 404

## Future updates

Back up the database and uploads before schema changes. Pull from GitHub through cPanel, activate the Node environment, and run from the application root:

```sh
npm --prefix "$PWD/backend" install --omit=dev
npm --prefix "$PWD/frontend" ci --include=dev
npm run build
npm run db:init
```

Click **Restart** and check `/api/health`. Preserve `.env` and `backend/uploads`; do not recreate existing admin accounts.
