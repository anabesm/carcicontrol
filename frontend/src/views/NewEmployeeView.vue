<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue'
import { ArrowLeft, Check, ShieldCheck, UserPlus } from '@lucide/vue'
import { useRouter } from 'vue-router'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseField from '@/components/ui/BaseField.vue'
import PasswordField from '@/components/ui/PasswordField.vue'
import { employeesApi } from '@/services/employees'
import { ApiError } from '@/services/api'
import { emailError, passwordError } from '@/utils/forms'
import type { Usuario } from '@/types/usuario'

const router = useRouter()
const form = reactive({ nome: '', email: '', telefone: '', senha: '', confirmacao: '' })
const errors = reactive({ nome: '', email: '', telefone: '', senha: '', confirmacao: '' })
type FieldName = keyof typeof form
const fields: Partial<Record<FieldName, { focus: () => void }>> = {}
const submitting = ref(false)
const errorMessage = ref('')
const created = ref<Usuario | null>(null)
const successHeading = ref<HTMLElement>()

async function focusError() {
  await nextTick()
  const name = (Object.keys(errors) as FieldName[]).find((key) => errors[key])
  if (name) fields[name]?.focus()
}
async function submit() {
  if (submitting.value) return
  errorMessage.value = ''
  errors.nome = !form.nome.trim()
    ? 'Informe o nome.'
    : form.nome.trim().length < 2 || form.nome.trim().length > 120
      ? 'Use entre 2 e 120 caracteres.'
      : ''
  errors.email = emailError(form.email)
  errors.telefone =
    form.telefone.trim() && (form.telefone.trim().length < 3 || form.telefone.trim().length > 30)
      ? 'Use entre 3 e 30 caracteres.'
      : ''
  errors.senha = passwordError(form.senha, 8)
  errors.confirmacao = !form.confirmacao
    ? 'Confirme a senha.'
    : form.senha !== form.confirmacao
      ? 'As senhas devem ser iguais.'
      : ''
  if (Object.values(errors).some(Boolean)) {
    await focusError()
    return
  }
  submitting.value = true
  try {
    const result = await employeesApi.create({
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      telefone: form.telefone.trim() || null,
      senha: form.senha,
    })
    form.senha = ''
    form.confirmacao = ''
    created.value = result.usuario
    await nextTick()
    successHeading.value?.focus()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return
    if (error instanceof ApiError && error.status === 403) {
      await router.replace('/acesso-negado')
      return
    }
    if (error instanceof ApiError && error.status === 409) {
      errors.email = error.message
    } else
      errorMessage.value =
        error instanceof Error ? error.message : 'Não foi possível cadastrar o funcionário.'
  } finally {
    submitting.value = false
  }
  if (errors.email) await focusError()
}
async function startAnother() {
  for (const name of Object.keys(form) as FieldName[]) {
    form[name] = ''
    errors[name] = ''
  }
  errorMessage.value = ''
  created.value = null
  await nextTick()
  fields.nome?.focus()
}
</script>

<template>
  <RouterLink to="/funcionarios" class="text-link back-link"
    ><ArrowLeft :size="16" />Funcionários</RouterLink
  >
  <div class="page-intro">
    <div>
      <p class="eyebrow">GESTÃO DE ACESSOS</p>
      <h1>Novo funcionário</h1>
      <p class="page-description">Libere o acesso de uma pessoa da sua equipe.</p>
    </div>
  </div>
  <section v-if="created" class="data-panel success-panel" aria-labelledby="success-heading">
    <span class="success-icon"><Check :size="26" /></span>
    <h2 id="success-heading" ref="successHeading" tabindex="-1">Funcionário cadastrado</h2>
    <p>
      <strong>{{ created.nome }}</strong> já pode entrar com o e-mail
      <strong>{{ created.email }}</strong> e a senha definida no cadastro.
    </p>
    <div class="form-actions">
      <BaseButton to="/funcionarios">Ver funcionários</BaseButton
      ><BaseButton variant="secondary" @click="startAnother">Cadastrar outro</BaseButton>
    </div>
  </section>
  <div v-else class="employee-form-layout">
    <section class="data-panel employee-form-panel" aria-labelledby="employee-form-heading">
      <div class="panel-heading">
        <h2 id="employee-form-heading">Dados do funcionário</h2>
        <p>Os campos com * são obrigatórios.</p>
      </div>
      <BaseAlert
        v-if="errorMessage"
        title="Não foi possível cadastrar"
        tone="error"
        class="form-notice"
        >{{ errorMessage }}</BaseAlert
      >
      <form class="form-stack" novalidate :aria-busy="submitting" @submit.prevent="submit">
        <BaseField
          :ref="
            (el) => {
              if (el) fields.nome = el as InstanceType<typeof BaseField>
            }
          "
          v-model="form.nome"
          label="Nome completo"
          name="nome"
          autocomplete="name"
          :maxlength="120"
          :error="errors.nome"
          :disabled="submitting"
          required
        />
        <BaseField
          :ref="
            (el) => {
              if (el) fields.email = el as InstanceType<typeof BaseField>
            }
          "
          v-model="form.email"
          label="E-mail"
          name="email"
          type="email"
          inputmode="email"
          autocomplete="off"
          :maxlength="254"
          :error="errors.email"
          :disabled="submitting"
          hint="Será usado para entrar no sistema."
          required
        />
        <BaseField
          :ref="
            (el) => {
              if (el) fields.telefone = el as InstanceType<typeof BaseField>
            }
          "
          v-model="form.telefone"
          label="Telefone (opcional)"
          name="telefone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          :maxlength="30"
          :error="errors.telefone"
          :disabled="submitting"
        />
        <div class="form-columns">
          <PasswordField
            :ref="
              (el) => {
                if (el) fields.senha = el as InstanceType<typeof PasswordField>
              }
            "
            v-model="form.senha"
            label="Senha inicial"
            name="senha"
            autocomplete="new-password"
            hint="Entre 8 e 128 caracteres."
            :error="errors.senha"
            :disabled="submitting"
          />
          <PasswordField
            :ref="
              (el) => {
                if (el) fields.confirmacao = el as InstanceType<typeof PasswordField>
              }
            "
            v-model="form.confirmacao"
            label="Confirmar senha"
            name="confirmacao"
            autocomplete="new-password"
            :error="errors.confirmacao"
            :disabled="submitting"
          />
        </div>
        <div class="form-actions">
          <BaseButton type="submit" :loading="submitting"
            ><UserPlus v-if="!submitting" :size="17" />{{
              submitting ? 'Cadastrando…' : 'Cadastrar funcionário'
            }}</BaseButton
          ><BaseButton to="/funcionarios" variant="ghost" :disabled="submitting"
            >Cancelar</BaseButton
          >
        </div>
      </form>
    </section>
    <aside class="employee-form-note">
      <ShieldCheck :size="23" :stroke-width="1.6" />
      <h2>Acesso à operação</h2>
      <p>
        O novo acesso terá o perfil de funcionário. A gestão de usuários fica com o administrador.
      </p>
      <p>Compartilhe a senha inicial com o funcionário por um canal seguro.</p>
    </aside>
  </div>
</template>
