import { useAzureAuth } from '@/composables/useAzureAuth'

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { acquireAccessToken } = useAzureAuth()
  const token = await acquireAccessToken(true)

  if (!token) {
    throw new Error('Autenticacion interactiva requerida. Intente nuevamente despues del login.')
  }

  const headers = new Headers(init.headers ?? {})
  headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, {
    ...init,
    headers,
  })
}
