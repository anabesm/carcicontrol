import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { viveirosApi } from '@/services/viveiros'
import { ApiError } from '@/services/api'
import type { DetalhesViveiro } from '@/types/viveiro'

export function useViveiro(id: () => string) {
  const router = useRouter()
  const viveiro = ref<DetalhesViveiro | null>(null)
  const loading = ref(true)
  const errorMessage = ref('')
  const notFound = ref(false)
  let version = 0

  async function load() {
    const requestVersion = ++version
    viveiro.value = null
    loading.value = true
    errorMessage.value = ''
    notFound.value = false
    try {
      const result = await viveirosApi.detail(id())
      if (requestVersion === version) viveiro.value = result.viveiro
    } catch (error) {
      if (requestVersion !== version || (error instanceof ApiError && error.status === 401)) return
      if (error instanceof ApiError && error.status === 403) {
        await router.replace('/acesso-negado')
        return
      }
      if (error instanceof ApiError && [400, 404].includes(error.status)) notFound.value = true
      else
        errorMessage.value =
          error instanceof Error ? error.message : 'Não foi possível carregar o viveiro.'
    } finally {
      if (requestVersion === version) loading.value = false
    }
  }
  watch(id, load, { immediate: true })
  onBeforeUnmount(() => {
    version++
  })
  return { viveiro, loading, errorMessage, notFound, load }
}
