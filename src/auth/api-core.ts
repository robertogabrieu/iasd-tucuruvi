function readCookie(name: string): string | undefined {
  return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1]
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function rawFetch(prefix: string, path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (MUTATING.has(method)) {
    const csrf = readCookie('csrf_token')
    if (csrf) headers.set('X-CSRF-Token', decodeURIComponent(csrf))
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  }
  return fetch(`${prefix}${path}`, { ...init, headers, credentials: 'same-origin' })
}

let refreshing: Promise<boolean> | null = null
function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = rawFetch('/api/auth', '/refresh', { method: 'POST' })
      .then(r => r.ok)
      .catch(() => false)
      .finally(() => { refreshing = null })
  }
  return refreshing
}

/** Garante que o cookie CSRF existe (chamar no boot). */
export async function ensureCsrf(): Promise<void> {
  if (!readCookie('csrf_token')) await rawFetch('/api/auth', '/csrf')
}

/** Cria um cliente para um prefixo (/api/auth, /api/admin) com auto-refresh em 401. */
export function makeApiClient(prefix: string) {
  async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    let res = await rawFetch(prefix, path, init)
    if (res.status === 401 && path !== '/refresh' && path !== '/login') {
      if (await tryRefresh()) res = await rawFetch(prefix, path, init)
    }
    return res
  }
  return { apiFetch }
}
