import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/services/auth'
import { ApiError } from '@/services/api'
import type { Usuario } from '@/types/usuario'

const sessionFlag = 'carcicontrol-session-present'

function hadSession(): boolean {
  try {
    return sessionStorage.getItem(sessionFlag) === '1'
  } catch {
    return false
  }
}

function rememberSession(present: boolean) {
  try {
    if (present) sessionStorage.setItem(sessionFlag, '1')
    else sessionStorage.removeItem(sessionFlag)
  } catch {
    /* A consulta ao servidor funciona mesmo sem armazenamento local. */
  }
}

export const useAuthStore = defineStore('auth', () => {
  const usuario = ref<Usuario | null>(null)
  const revision = ref(0)
  const notice = ref<'expired' | 'signed-out' | null>(null)
  const connectionError = ref('')
  let pending: Promise<Usuario | null> | null = null
  const isAdmin = computed(() => usuario.value?.perfil === 'ADMINISTRADOR')

  function clearSession(reason: 'expired' | 'signed-out' | null = null) {
    revision.value++
    pending = null
    usuario.value = null
    connectionError.value = ''
    if (reason) notice.value = reason
    rememberSession(false)
  }

  function restoreSession(): Promise<Usuario | null> {
    if (pending) return pending
    const version = revision.value
    const work = async () => {
      try {
        const result = await authApi.me()
        if (version !== revision.value) return usuario.value
        if (usuario.value?.id !== result.usuario.id) revision.value++
        usuario.value = result.usuario
        connectionError.value = ''
        rememberSession(true)
        return result.usuario
      } catch (error) {
        if (version !== revision.value) return usuario.value
        if (error instanceof ApiError && error.status === 401) {
          clearSession(usuario.value || hadSession() ? 'expired' : null)
          return null
        }
        connectionError.value =
          error instanceof Error ? error.message : 'Não foi possível verificar seu acesso.'
        throw error
      }
    }
    const request: Promise<Usuario | null> = work().finally(() => {
      if (pending === request) pending = null
    })
    pending = request
    return request
  }

  async function signIn(email: string, senha: string) {
    const version = ++revision.value
    pending = null
    const result = await authApi.login(email.trim().toLowerCase(), senha)
    if (version !== revision.value)
      throw new ApiError(409, 'O acesso foi interrompido. Tente novamente.')
    usuario.value = result.usuario
    connectionError.value = ''
    notice.value = null
    rememberSession(true)
  }

  async function signOut() {
    try {
      await authApi.logout()
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
    clearSession('signed-out')
  }

  return {
    usuario,
    revision,
    notice,
    connectionError,
    isAdmin,
    restoreSession,
    signIn,
    signOut,
    clearSession,
  }
})
