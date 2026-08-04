const fallbackRedirectUri = typeof window !== 'undefined'
  ? window.location.origin
  : 'http://localhost:5173'

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID?.trim() ?? ''
const authority = import.meta.env.VITE_AZURE_AUTHORITY?.trim() ?? ''
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI?.trim() || fallbackRedirectUri
const postLogoutRedirectUri = import.meta.env.VITE_AZURE_POST_LOGOUT_REDIRECT_URI?.trim() || fallbackRedirectUri

const scopes = (import.meta.env.VITE_AZURE_SCOPES ?? '')
  .split(',')
  .map((scope: string) => scope.trim())
  .filter(Boolean)

export const hasAzureAuthConfig = Boolean(clientId && authority && scopes.length > 0)

export const azureAuthConfigError = hasAzureAuthConfig
  ? ''
  : 'Faltan variables VITE_AZURE_CLIENT_ID, VITE_AZURE_AUTHORITY o VITE_AZURE_SCOPES'

export const msalConfig = {
  auth: {
    clientId,
    authority,
    redirectUri,
    postLogoutRedirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage' as const,
  },
}

export const loginRequest = {
  scopes,
}
