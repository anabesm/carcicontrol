<script setup lang="ts">
import { ref } from 'vue'
import { WifiOff } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import AccessLayout from '@/components/layout/AccessLayout.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import { useAuthStore } from '@/stores/auth'
import { safeRedirect } from '@/utils/access'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const checking = ref(false)
async function retry() {
  checking.value = true
  try {
    await auth.restoreSession()
    await router.replace(safeRedirect(route.query.redirect))
  } catch {
    /* O aviso do estado de conexão permite uma nova tentativa. */
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <AccessLayout>
    <div class="access-heading">
      <span class="access-icon"><WifiOff :size="24" /></span>
      <h1>Vamos verificar a conexão</h1>
      <p>Não foi possível confirmar seu acesso ao sistema.</p>
    </div>
    <BaseAlert title="Serviço indisponível" tone="error" class="form-notice">{{
      auth.connectionError || 'Confira sua conexão e tente novamente.'
    }}</BaseAlert>
    <div class="form-stack">
      <BaseButton :loading="checking" @click="retry">Tentar novamente</BaseButton>
      <BaseButton variant="ghost" to="/login">Ir para o login</BaseButton>
    </div>
  </AccessLayout>
</template>
