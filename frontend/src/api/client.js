const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
let csrfToken = null
let sessionRequest = null

async function decode(response) {
  const data = await response.json().catch(error => {
    if (error.name === 'AbortError') throw error
    throw new Error('The server returned an unexpected response. Please try again.', { cause: error })
  })
  if (!response.ok) {
    const error = Object.assign(new Error(data.message || 'Request failed.'), { status: response.status, errors: data.errors })
    if (response.status === 401) window.dispatchEvent(new Event('session-expired'))
    throw error
  }
  return data
}
export async function getSession() {
  if (!sessionRequest) sessionRequest = fetch(`${base}/api/session`, { credentials: 'include' }).then(decode).then(data => { csrfToken = data.csrfToken; return data }).finally(() => { sessionRequest = null })
  return sessionRequest
}
export async function api(url, options = {}) {
  const method = options.method || 'GET'
  const headers = { ...options.headers }
  if (method !== 'GET') {
    if (!csrfToken) await getSession()
    headers['X-CSRF-Token'] = csrfToken
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  }
  let response
  try { response = await fetch(`${base}${url}`, { ...options, method, headers, credentials: 'include' }) }
  catch (error) { if (error.name === 'AbortError') throw error; throw new Error('Cannot reach the server. Please check your connection and try again.', { cause: error }) }
  const data = await decode(response)
  if (data.csrfToken) csrfToken = data.csrfToken
  if (url.endsWith('/logout')) csrfToken = null
  return data
}
export async function fetchImage(url, signal) {
  const response = await fetch(`${base}${url}`, { credentials: 'include', signal })
  if (!response.ok) { await decode(response); return }
  return response.blob()
}
