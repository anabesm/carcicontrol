import { onBeforeUnmount, ref, shallowRef } from 'vue'

export function useResource<T>(fetcher: () => Promise<T>, initial: T) {
  const data = shallowRef<T>(initial)
  const loading = ref(false)
  const error = ref('')
  let revision = 0
  onBeforeUnmount(() => {
    revision++
  })
  async function load() {
    const current = ++revision
    loading.value = true
    error.value = ''
    try {
      const result = await fetcher()
      if (current === revision) data.value = result
    } catch (cause) {
      if (current === revision)
        error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar os dados.'
    } finally {
      if (current === revision) loading.value = false
    }
  }
  return { data, loading, error, load }
}
