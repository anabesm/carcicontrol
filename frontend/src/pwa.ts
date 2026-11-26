import { ref } from 'vue'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
export const canInstall = ref(false)
export const installError = ref('')
let prompt: InstallPrompt | null = null
let initialized = false

export async function installApp() {
  if (!prompt) return
  installError.value = ''
  const current = prompt
  prompt = null
  canInstall.value = false
  try {
    await current.prompt()
    await current.userChoice
  } catch {
    installError.value = 'Use a opção de instalar aplicativo no menu do navegador.'
  }
}
export function initializePwa() {
  if (initialized) return
  initialized = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    if (window.matchMedia('(display-mode: standalone)').matches) return
    prompt = event as InstallPrompt
    canInstall.value = true
  })
  window.addEventListener('appinstalled', () => {
    prompt = null
    canInstall.value = false
  })
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const register = async () => {
    try {
      await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      })
    } catch {
      // Access through the browser remains available when registration cannot complete.
    }
  }
  if (document.readyState === 'complete') void register()
  else window.addEventListener('load', () => void register(), { once: true })
}
