import express from 'express'
import path from 'node:path'
import { existsSync } from 'node:fs'

export function attachFrontend(app, directory) {
  const index = path.join(directory, 'index.html')
  if (!existsSync(index)) throw Object.assign(new Error('Build the frontend before starting in production.'), { code: 'FRONTEND_BUILD_MISSING' })
  app.use(express.static(directory, { dotfiles: 'deny', index: false }))
  app.get('/{*page}', (req, res, next) => {
    if (!req.accepts('html') || path.extname(req.path) || req.path.split('/').some(part => part.startsWith('.'))) return next()
    res.set('Cache-Control', 'no-cache').sendFile(index)
  })
}
