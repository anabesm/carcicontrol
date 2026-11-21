<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { employeesApi } from '@/services/employees'
import type { Usuario } from '@/types/usuario'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseField from '@/components/ui/BaseField.vue'
import PasswordField from '@/components/ui/PasswordField.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
const props = defineProps<{ id: string }>()
const user = ref<Usuario | null>(null)
const form = reactive({ nome: '', email: '', telefone: '' })
const password = ref(''),
  confirmPassword = ref('')
const loading = ref(true),
  saving = ref(false),
  error = ref(''),
  success = ref('')
const action = ref<'status' | 'password' | null>(null)
async function load() {
  loading.value = true
  error.value = ''
  try {
    user.value = (await employeesApi.detail(props.id)).usuario
    Object.assign(form, {
      nome: user.value.nome,
      email: user.value.email,
      telefone: user.value.telefone ?? '',
    })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar.'
  } finally {
    loading.value = false
  }
}
async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    user.value = (
      await employeesApi.update(props.id, { ...form, telefone: form.telefone || null })
    ).usuario
    success.value = 'Dados atualizados.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível salvar.'
  } finally {
    saving.value = false
  }
}
function preparePassword() {
  error.value = ''
  success.value = ''
  if (password.value.length < 8 || password.value !== confirmPassword.value) {
    error.value = 'Use uma senha de ao menos oito caracteres e confirme a mesma senha.'
    return
  }
  action.value = 'password'
}
async function confirm() {
  if (saving.value || !user.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    if (action.value === 'password') {
      await employeesApi.resetPassword(props.id, password.value)
      password.value = ''
      confirmPassword.value = ''
      success.value = 'Senha redefinida. As sessões anteriores foram encerradas.'
    } else {
      user.value = (
        await employeesApi.update(props.id, {
          status: user.value.status === 'ATIVO' ? 'INATIVO' : 'ATIVO',
        })
      ).usuario
      success.value = 'Situação atualizada. As sessões anteriores foram encerradas.'
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível concluir.'
  } finally {
    saving.value = false
    action.value = null
  }
}
onMounted(load)
</script>
<template>
  <RouterLink to="/funcionarios" class="text-link back-link">Voltar aos funcionários</RouterLink>
  <div class="page-intro"><h1>Editar funcionário</h1></div>
  <BaseLoading v-if="loading" /><BaseAlert
    v-if="error"
    tone="error"
    title="Não foi possível concluir"
    >{{ error }}</BaseAlert
  ><BaseAlert v-if="success" title="Alteração salva">{{ success }}</BaseAlert>
  <template v-if="!loading && user"
    ><section class="data-panel record-panel">
      <form class="form-stack" @submit.prevent="save">
        <BaseField
          v-model="form.nome"
          label="Nome"
          required
          :maxlength="120"
          :disabled="saving"
        /><BaseField
          v-model="form.email"
          label="E-mail"
          type="email"
          required
          :maxlength="254"
          :disabled="saving"
        /><BaseField
          v-model="form.telefone"
          label="Telefone"
          type="tel"
          :maxlength="30"
          :disabled="saving"
        />
        <div><BaseButton type="submit" :disabled="saving">Salvar alterações</BaseButton></div>
      </form>
    </section>
    <section class="data-panel record-panel">
      <h2>Acesso</h2>
      <p>
        Situação: <strong>{{ user.status === 'ATIVO' ? 'Ativo' : 'Inativo' }}</strong>
      </p>
      <div class="inline-actions">
        <BaseButton variant="secondary" :disabled="saving" @click="action = 'status'">{{
          user.status === 'ATIVO' ? 'Inativar funcionário' : 'Ativar funcionário'
        }}</BaseButton>
      </div>
    </section>
    <section class="data-panel record-panel">
      <h2>Redefinir senha</h2>
      <form class="form-stack" @submit.prevent="preparePassword">
        <PasswordField
          v-model="password"
          name="novaSenha"
          label="Nova senha"
          autocomplete="new-password"
          :disabled="saving"
        /><PasswordField
          v-model="confirmPassword"
          name="confirmarSenha"
          label="Confirmar nova senha"
          autocomplete="new-password"
          :disabled="saving"
        />
        <div>
          <BaseButton type="submit" variant="secondary" :disabled="saving"
            >Redefinir senha</BaseButton
          >
        </div>
      </form>
    </section></template
  >
  <ConfirmDialog
    :open="Boolean(action)"
    :title="action === 'password' ? 'Redefinir senha' : 'Alterar acesso'"
    :busy="saving"
    @cancel="action = null"
    @confirm="confirm"
    ><p>{{ user?.nome }}</p>
    <p>
      {{
        action === 'password'
          ? 'A nova senha substituirá a atual.'
          : user?.status === 'ATIVO'
            ? 'O funcionário perderá o acesso ao sistema.'
            : 'O funcionário poderá entrar novamente.'
      }}
      As sessões anteriores serão encerradas.
    </p></ConfirmDialog
  >
</template>
