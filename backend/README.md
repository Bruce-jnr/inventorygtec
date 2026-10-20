# Backend

Express API for Student Inventory. See [../README.md](../README.md) for full setup and [../docs/OPERATIONS.md](../docs/OPERATIONS.md) for deployment.

From this folder:

```sh
npm install
npm run db:init
npm run admin:create
npm run dev
```

Configuration lives in private `.env`; use `.env.example` as the template. Session signing uses `SESSION_SECRET`, or the existing `JWT_SECRET` as a fallback. Database credentials never belong in frontend files.

- `npm test`: isolated MySQL API tests.
- `npm run test:browser`: Chrome/Edge workflows and A4 PDF checks.
- `npm run uploads:audit`: report missing images and old orphan files.
- `npm start`: start without the development watcher.

The API listens on port 5000 by default. `/api/health` checks database connectivity. Private images are streamed exclusively through authenticated `/api/admin/candidates/:id/passport` and `/certificate` routes; uploads are never served as static files.

