import express from 'express';
import { attachFrontend } from './middleware/frontend.js';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { MysqlSessionStore } from './session-store.js';
import { csrfProtection } from './middleware/auth.js';
import { candidateRoutes } from './routes/candidateRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { studentRoutes } from './routes/studentRoutes.js';

export function createApp({ pool, config, store }) {
  if (!config.secret || config.secret.length < 32)
    throw new Error('Set SESSION_SECRET (or JWT_SECRET)');
  const app = express();
  app.disable('x-powered-by');
  if (config.production) app.set('trust proxy', 1);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: {
      directives: {
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
      },
    },
  }));
  app.use(cors({ origin: config.origin, credentials: true }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', async (req, res) => {
    try {
      await pool.execute('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res
        .status(503)
        .json({ status: 'unavailable', message: 'Database is unavailable.' });
    }
  });
  const sessionStore = store || new MysqlSessionStore(pool);
  app.locals.sessionStore = sessionStore;
  app.use(
    '/api',
    session({
      name: 'candidate.sid',
      secret: config.secret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.production,
        maxAge: 60 * 60 * 1000,
      },
    }),
  );
  app.get('/api/session', (req, res, next) => {
    if (!req.session.csrfToken)
      req.session.csrfToken = randomBytes(32).toString('hex');
    const admin =
      req.session.authExpiresAt > Date.now() ? req.session.admin : null;
    req.session.save((error) =>
      error
        ? next(error)
        : res.json({
            admin: admin || null,
            csrfToken: req.session.csrfToken,
            maxUploadBytes: config.maxUploadBytes,
          }),
    );
  });
  app.use('/api', csrfProtection(config.origin));
  app.use('/api/candidates', candidateRoutes(pool, config));
  app.use('/api/student', studentRoutes(pool, config));
  app.use('/api/admin', adminRoutes(pool, config));
  app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
  if (config.serveFrontend) attachFrontend(app, config.frontendDir);
  app.use((req, res) =>
    res.status(404).json({ message: 'Endpoint not found.' }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ message: 'Send a valid JSON request.' });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ message: 'This request is too large.' });
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        message: tooLarge
          ? `Each image must be ${config.maxUploadBytes / 1024 / 1024} MB or smaller.`
          : 'Upload one passport photo, one required certificate and an optional second certificate, with the registration fields.',
      });
    }
    const status = [400, 403, 409, 413, 415].includes(error.status)
      ? error.status
      : 500;
    if (status === 500)
      console.error('API request failed:', error.code || error.name);
    res.status(status).json({
      message:
        status === 500
          ? 'We could not complete your request. Please try again.'
          : error.message,
    });
  });
  return app;
}

