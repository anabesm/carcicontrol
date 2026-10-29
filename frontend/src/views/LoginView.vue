<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue'
import { ArrowRight, LockKeyhole } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import AccessLayout from '@/components/layout/AccessLayout.vue'
import BaseField from '@/components/ui/BaseField.vue'
import PasswordField from '@/components/ui/PasswordField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/services/api'
import { safeRedirect } from '@/utils/access'
import { emailError, passwordError } from '@/utils/forms'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const email = ref('')
const senha = ref('')
const errors = reactive({ email: '', senha: '' })
const emailField = ref<InstanceType<typeof BaseField>>()
const passwordField = ref<InstanceType<typeof PasswordField>>()
const submitting = ref(false)
const errorMessage = ref('')

async function submit() {
  if (submitting.value) return
  errorMessage.value = ''
  errors.email = emailError(email.value)
  errors.senha = passwordError(senha.value)
  if (errors.email || errors.senha) {
    await nextTick()
    if (errors.email) emailField.value?.focus()
    else passwordField.value?.focus()
    return
  }
  submitting.value = true
  try {
    await auth.signIn(email.value, senha.value)
    senha.value = ''
    await router.replace(safeRedirect(route.query.redirect))
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : 'Não foi possível entrar. Tente novamente.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AccessLayout>
    <div class="access-heading">
      <span class="access-icon"><LockKeyhole :size="23" :stroke-width="1.6" /></span>
      <h1>Acesse sua conta</h1>
      <p>Entre para acompanhar o seu cultivo.</p>
    </div>
    <BaseAlert
      v-if="auth.notice === 'expired' || route.query.motivo === 'sessao-expirada'"
      title="Sua sessão expirou"
      class="form-notice"
      >Entre novamente para continuar.</BaseAlert
    >
    <BaseAlert
      v-else-if="auth.notice === 'signed-out'"
      title="Você saiu da sua conta"
      tone="success"
      class="form-notice"
      >Sua sessão foi encerrada com segurança.</BaseAlert
    >
    <BaseAlert
      v-if="errorMessage"
      title="Não foi possível entrar"
      tone="error"
      class="form-notice"
      >{{ errorMessage }}</BaseAlert
    >
    <form class="form-stack" novalidate :aria-busy="submitting" @submit.prevent="submit">
      <BaseField
        ref="emailField"
        v-model="email"
        label="E-mail"
        name="email"
        type="email"
        inputmode="email"
        autocomplete="username"
        placeholder="seu@email.com"
        :maxlength="254"
        :error="errors.email"
        :disabled="submitting"
        required
      />
      <PasswordField
        ref="passwordField"
        v-model="senha"
        label="Senha"
        name="senha"
        :error="errors.senha"
        :disabled="submitting"
      />
      <BaseButton type="submit" :loading="submitting" class="button-full"
        >{{ submitting ? 'Entrando…' : 'Entrar' }}<ArrowRight v-if="!submitting" :size="17"
      /></BaseButton>
    </form>
    <p class="access-note">Precisa de acesso? Solicite uma conta ao administrador da sua equipe.</p>
  </AccessLayout>
</template>
