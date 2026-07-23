import { PublicClientApplication } from '@azure/msal-browser'
import { msalConfig } from '@/auth/authConfig'

export const msalInstance = new PublicClientApplication(msalConfig)

let initPromise: Promise<void> | null = null

export function ensureMsalInitialized(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = msalInstance.initialize().then(async () => {
    const response = await msalInstance.handleRedirectPromise()
    const account = response?.account ?? msalInstance.getAllAccounts()[0]
    if (account) {
      msalInstance.setActiveAccount(account)
    }
  })

  return initPromise
}

export function getActiveAccount() {
  return msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null
}
