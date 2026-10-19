import session from 'express-session'

export class MysqlSessionStore extends session.Store {
  constructor(pool) {
    super()
    this.pool = pool
    this.timer = setInterval(() => {
      this.pool.execute('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]).catch(() => {})
    }, 15 * 60 * 1000)
    this.timer.unref()
  }
  get(id, callback) {
    this.pool.execute('SELECT data FROM sessions WHERE session_id = ? AND expires_at > ?', [id, Date.now()])
      .then(([rows]) => callback(null, rows.length ? JSON.parse(rows[0].data) : null)).catch(callback)
  }
  set(id, data, callback = () => {}) {
    const expires = new Date(data.cookie.expires).getTime()
    this.pool.execute('INSERT INTO sessions (session_id, expires_at, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE expires_at = ?, data = ?',
      [id, expires, JSON.stringify(data), expires, JSON.stringify(data)]).then(() => callback()).catch(callback)
  }
  destroy(id, callback = () => {}) {
    this.pool.execute('DELETE FROM sessions WHERE session_id = ?', [id]).then(() => callback()).catch(callback)
  }
  touch(id, data, callback = () => {}) {
    this.pool.execute('UPDATE sessions SET expires_at = ? WHERE session_id = ?',
      [new Date(data.cookie.expires).getTime(), id]).then(() => callback()).catch(callback)
  }
  close() { clearInterval(this.timer) }
}
