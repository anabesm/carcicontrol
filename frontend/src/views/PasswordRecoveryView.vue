<script setup lang="ts">
import { ref } from 'vue'
import { apiRequest } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import AccessLayout from '@/components/layout/AccessLayout.vue'
import BaseField from '@/components/ui/BaseField.vue'
import PasswordField from '@/components/ui/PasswordField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
const props = defineProps<{ reset?: boolean }>()
const auth = useAuthStore()
const email = ref(''),
  password = ref(''),
  confirmation = ref('')
const token = ref(new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
if (props.reset && window.location.hash)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
const saving = ref(false),
  error = ref(''),
  success = ref('')
async function submit() {
  if (saving.value) return
  error.value = ''
  success.value = ''
  if (props.reset && (password.value.length < 8 || password.value !== confirmation.value)) {
    error.value = 'Use uma senha de ao menos oito caracteres e confirme a mesma senha.'
    return
  }
  saving.value = true
  try {
    if (props.reset) {
      await apiRequest('/auth/redefinir-senha', {
        method: 'POST',
        body: { token: token.value, senha: password.value },
        notifyUnauthorized: false,
      })
      auth.clearSession('signed-out')
      token.value = ''
      password.value = ''
      confirmation.value = ''
      success.value = 'Senha redefinida. Entre com a nova senha.'
    } else {
      const result = await apiRequest<{ mensagem: string }>('/auth/recuperar-senha', {
        method: 'POST',
        body: { email: email.value },
        notifyUnauthorized: false,
      })
      success.value = result.mensagem
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível concluir.'
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <AccessLayout>
    <div class="access-heading">
      <h1>{{ reset ? 'Definir nova senha' : 'Recuperar senha' }}</h1>
    </div>
    <BaseAlert v-if="success" title="Solicitação concluída">{{ success }}</BaseAlert>
    <BaseAlert v-if="error" title="Não foi possível concluir" tone="error">{{ error }}</BaseAlert>
    <template v-if="!success"
      ><BaseAlert v-if="reset && !token" title="Link inválido" tone="error"
        >Abra o link recebido por e-mail ou solicite outro.</BaseAlert
      >
      <form v-else class="form-stack" @submit.prevent="submit">
        <template v-if="reset"
          ><PasswordField
            v-model="password"
            label="Nova senha"
            name="novaSenha"
            autocomplete="new-password"
            :disabled="saving" /><PasswordField
            v-model="confirmation"
            label="Confirmar nova senha"
            name="confirmarSenha"
            autocomplete="new-password"
            :disabled="saving"
        /></template>
        <BaseField
          v-else
          v-model="email"
          type="email"
          label="E-mail"
          autocomplete="email"
          required
          :maxlength="254"
          :disabled="saving"
        />
        <BaseButton type="submit" :disabled="saving" class="button-full">{{
          saving ? 'Enviando…' : reset ? 'Salvar nova senha' : 'Enviar instruções'
        }}</BaseButton>
      </form>
    </template>
    <div class="inline-actions">
      <RouterLink to="/login" class="text-link">Voltar ao login</RouterLink
      ><RouterLink v-if="reset && !success" to="/recuperar-senha" class="text-link"
        >Solicitar outro link</RouterLink
      >
    </div>
  </AccessLayout>
</template>
