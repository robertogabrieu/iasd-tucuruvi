import { makeApiClient, ensureCsrf } from './api-core.js'

const client = makeApiClient('/api/auth')
export const apiFetch = client.apiFetch
export { ensureCsrf }
