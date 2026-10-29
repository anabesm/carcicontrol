<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CircleCheck, RefreshCw, Server, WifiOff } from '@lucide/vue'
import { apiRequest } from '@/services/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'

const state = ref<'loading' | 'online' | 'offline'>('loading')

async function checkConnection() {
  if (state.value === 'loading' && checked.value) return
  checked.value = true
  state.value = 'loading'
  try {
    const result = await apiRequest<{ status: string; database: string }>('/health')
    state.value = result.status === 'ok' && result.database === 'up' ? 'online' : 'offline'
  } catch {
    state.value = 'offline'
  }
}
const checked = ref(false)
onMounted(checkConnection)
</script>

<template>
  <section class="connection-card" aria-labelledby="connection-heading">
    <div class="panel-heading">
      <Server :size="17" :stroke-width="1.7" />
      <h2 id="connection-heading">Conexão com o sistema</h2>
    </div>
    <BaseLoading v-if="state === 'loading'" label="Verificando conexão…" />
    <div v-else class="connection-result" :class="`connection-result--${state}`" role="status">
      <component :is="state === 'online' ? CircleCheck : WifiOff" :size="20" :stroke-width="1.8" />
      <div>
        <p>{{ state === 'online' ? 'Sistema disponível' : 'Conexão indisponível' }}</p>
        <span>{{
          state === 'online'
            ? 'Tudo certo para continuar.'
            : 'Tente verificar novamente em instantes.'
        }}</span>
      </div>
    </div>
    <BaseButton
      variant="secondary"
      size="small"
      :loading="state === 'loading'"
      @click="checkConnection"
    >
      <RefreshCw v-if="state !== 'loading'" :size="15" />
      {{ state === 'loading' ? 'Verificando…' : 'Verificar novamente' }}
    </BaseButton>
  </section>
</template>
