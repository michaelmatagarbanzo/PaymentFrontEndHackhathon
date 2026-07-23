import { readonly, ref } from 'vue'
import type { AccountInfo } from '@azure/msal-browser'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { azureAuthConfigError, hasAzureAuthConfig, loginRequest } from '@/auth/authConfig'
import { ensureMsalInitialized, getActiveAccount, msalInstance } from '@/auth/msal'

const account = ref<AccountInfo | null>(null)
const isLoading = ref(true)
const isAuthenticating = ref(false)
const authError = ref('')

async function syncAccount() {
  if (!hasAzureAuthConfig) {
    isLoading.value = false
    authError.value = azureAuthConfigError
    return
  }

  try {
    await ensureMsalInitialized()
    account.value = getActiveAccount()
    if (account.value) {
      msalInstance.setActiveAccount(account.value)
    }
    authError.value = ''
  } catch (err) {
    authError.value = `Error inicializando MSAL: ${(err as Error).message}`
  } finally {
    isLoading.value = false
  }
}

void syncAccount()

async function login() {
  if (!hasAzureAuthConfig) {
    authError.value = azureAuthConfigError
    throw new Error(azureAuthConfigError)
  }

  isAuthenticating.value = true
  authError.value = ''

  try {
    await ensureMsalInitialized()
    await msalInstance.loginRedirect(loginRequest)
  } catch (err) {
    authError.value = `Error al iniciar sesion: ${(err as Error).message}`
    throw err
  } finally {
    isAuthenticating.value = false
  }
}

async function logout() {
  if (!hasAzureAuthConfig) return

  isAuthenticating.value = true
  authError.value = ''

  try {
    await ensureMsalInitialized()
    await msalInstance.logoutRedirect()
  } catch (err) {
    authError.value = `Error al cerrar sesion: ${(err as Error).message}`
    throw err
  } finally {
    isAuthenticating.value = false
  }
}

async function acquireAccessToken(interactiveOnFail = true): Promise<string | null> {
  if (!hasAzureAuthConfig) {
    authError.value = azureAuthConfigError
    throw new Error(azureAuthConfigError)
  }

  await ensureMsalInitialized()

  let active = getActiveAccount()
  if (!active) {
    const accounts = msalInstance.getAllAccounts()
    active = accounts[0] ?? null
  }

  if (!active) {
    authError.value = 'No hay una sesion activa. Debe iniciar sesion.'
    throw new Error(authError.value)
  }

  msalInstance.setActiveAccount(active)
  account.value = active

  try {
    const result = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: active,
    })
    authError.value = ''
    return result.accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError && interactiveOnFail) {
      await msalInstance.acquireTokenRedirect(loginRequest)
      return null
    }

    authError.value = `Error obteniendo token: ${(err as Error).message}`
    throw err
  }
}

export function useAzureAuth() {
  return {
    account: readonly(account),
    isLoading: readonly(isLoading),
    isAuthenticating: readonly(isAuthenticating),
    authError: readonly(authError),
    hasConfig: hasAzureAuthConfig,
    configError: azureAuthConfigError,
    login,
    logout,
    acquireAccessToken,
    syncAccount,
  }
}
