import { ref, computed } from 'vue'
import merchantsConfig from '@/config/merchants.config.json'

export type SdkSource = 'config' | 'url' | 'local'

const LOCAL_JS_KEY   = 'sdk_local_js'
const LOCAL_NAME_KEY = 'sdk_local_name'

// Module-level singleton — shared across all components
const source       = ref<SdkSource>('config')
const customUrl    = ref('')
const localFileName = ref(localStorage.getItem(LOCAL_NAME_KEY) ?? '')

const configUrl = (() => {
  const env = merchantsConfig.environment as keyof typeof merchantsConfig.safekeyScripts
  return merchantsConfig.safekeyScripts[env] ?? merchantsConfig.safekeyScripts.production
})()

export const resolvedSdkUrl = computed<string>(() => {
  if (source.value === 'config') return configUrl
  if (source.value === 'url')    return customUrl.value.trim() || configUrl
  return '__local__'
})

export function useSdkSource() {
  async function pickLocalFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    localStorage.setItem(LOCAL_JS_KEY, text)
    localStorage.setItem(LOCAL_NAME_KEY, file.name)
    localFileName.value = file.name
    source.value = 'local'
  }

  return { source, customUrl, localFileName, configUrl, resolvedSdkUrl, pickLocalFile }
}

/**
 * Loads the 3DS SDK script, always replacing any existing script with the same ID.
 * Handles the '__local__' sentinel by reading content from localStorage and creating a blob URL.
 */
export async function loadSdkUrl(resolvedUrl: string, scriptId: string): Promise<void> {
  document.getElementById(scriptId)?.remove()

  let src = resolvedUrl

  if (resolvedUrl === '__local__') {
    const content = localStorage.getItem(LOCAL_JS_KEY)
    if (!content) throw new Error('No hay archivo SDK local. Seleccione un archivo .js primero.')
    const blob = new Blob([content], { type: 'text/javascript' })
    src = URL.createObjectURL(blob)
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id    = scriptId
    script.src   = src
    script.async = true
    script.onload  = () => resolve()
    script.onerror = () => reject(new Error(`No se pudo cargar el SDK: ${src}`))
    document.head.appendChild(script)
  })
}
