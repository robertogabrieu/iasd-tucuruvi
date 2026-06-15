import { makeApiClient } from '@/auth/api-core'

const client = makeApiClient('/api/admin')
export const adminFetch = client.apiFetch
