/**
 * Dynamically loads an external script and returns a promise that resolves
 * when the script is ready. Idempotent — won't load the same script twice.
 */
export function loadScript(src: string, id?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (id && document.getElementById(id)) {
      resolve()
      return
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existingScript) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    if (id) script.id = id

    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))

    document.head.appendChild(script)
  })
}
