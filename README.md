# Student Inventory

A React/Vite candidate registration portal with an Express/MySQL administration API. Requirements are in [INSTRUCTION.md](./INSTRUCTION.md).

## Features

- Public registration with surname, first name, optional middle name, admission year, level 100–400, mode of entry (Regular or Matured), date of birth, passport, a required certificate and an optional second certificate.
- Students can retrieve their form at `/retrieve` using the reference and date of birth, correct their details, keep or replace images, and resubmit under the same reference. Editing sessions expire after 15 minutes; concurrent stale edits are rejected.
- JPG/PNG previews, inline validation, configurable 15 MB uploads compressed to at most 3 MB per saved image, and an idempotent submission reference.
- MySQL persistence, image content validation and normalization, private UUID upload storage, and failed-upload cleanup.
- Admin login/logout with bcrypt, one-hour MySQL-backed HttpOnly sessions, CSRF protection, and request rate limits.
- Candidate totals, name search, admission year/level filters, pagination, private documents and record details.
- Single-page A4 printing with surname-first names, passport photo and adjustable certificate cropping. Two certificates print side by side with independent crop settings; printed records omit registration references, dates and status badges.

## Layout

```text
frontend/        React pages, components, API client and styles
backend/         Express API, middleware, MySQL sessions, setup scripts and tests
backend/uploads/ Private runtime images (ignored by Git)
database/        MySQL schema
artifacts/       Browser QA screenshots and sample PDFs (ignored by Git)
docs/            Deployment, cleanup, retention and backup guidance
```

## Local setup

Requires Node.js 22+, npm and MySQL 8. From the project root:

```sh
npm run setup
```

Create `.env` using `.env.example` if it does not already exist. Set your MySQL credentials, `DB_NAME`, and a random `SESSION_SECRET` of at least 32 characters. An existing `JWT_SECRET` can also sign the server sessions. Keep credentials in the private root .env file.

```sh
npm run db:init
npm run admin:create
```

Database setup creates the configured database and missing tables without dropping existing tables. It needs CREATE privileges. Administrator setup asks for your chosen username and a hidden password; there are no default credentials.

Start the API and frontend in two terminals:

```sh
npm run dev:api
```

```sh
npm run dev
```

Open `http://localhost:5173`. Admin sign-in is at `/admin/login`. The frontend proxies `/api` to port 5000. If you change the API port, update `frontend/vite.config.js`, or set `VITE_API_BASE_URL` using `frontend/.env.example`. `FRONTEND_ORIGIN` must exactly match the frontend URL. Keep the frontend and API on the same site for cookie authentication.

## Verification

```sh
npm run lint
npm run build
npm test
npm run test:browser
```

API tests use real MySQL with a unique temporary test database and clean it up afterwards. The configured database account needs CREATE/DROP privileges for testing; use a separate development account rather than granting these privileges to the production runtime account. Tests never seed sample records or accounts into the application database.

Browser checks require installed Chrome and Microsoft Edge. They use isolated MySQL fixtures and check registration, previews, login, filters, private images, logout, responsive layouts, certificate cropping and single-page A4 PDFs in both browsers. Screenshots and PDFs are saved in `artifacts/`.

`npm run build` writes `frontend/dist/`. `npm run preview` previews that build; run the API separately and configure an API origin/proxy when serving the production build.

## Deployment and data handling

For cPanel, choose root **app.js** as the startup file and keep configuration in the root **.env**. `npm start` launches the server; with `NODE_ENV=production`, it serves both the built React app and API. See [docs/CPANEL.md](./docs/CPANEL.md) for installation and hosting settings.

See [docs/OPERATIONS.md](./docs/OPERATIONS.md) before deploying. It covers HTTPS, reverse proxies, database permissions, private storage, orphan audits, retention decisions and consistent encrypted backups. Local setup does not deploy the application or schedule production backups.


