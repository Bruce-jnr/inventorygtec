import { timingSafeEqual } from 'node:crypto'

export function requireAdmin(req, res, next) {
  if (!req.session.admin || !req.session.authExpiresAt || req.session.authExpiresAt <= Date.now()) return res.status(401).json({ message: 'Please sign in to continue.' })
  next()
}
export function csrfProtection(origin) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    if (req.headers.origin && req.headers.origin !== origin) return res.status(403).json({ message: 'This request origin is not allowed.' })
    const expected = req.session.csrfToken
    const actual = req.get('X-CSRF-Token')
    if (typeof expected !== 'string' || typeof actual !== 'string' || Buffer.byteLength(expected) !== Buffer.byteLength(actual) || !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
      return res.status(403).json({ message: 'Your form session expired. Refresh the page and try again.' })
    }
    next()
  }
}
