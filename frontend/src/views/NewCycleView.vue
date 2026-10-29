<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ArrowLeft, Check, Sprout } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useViveiro } from '@/composables/useViveiro'
import { viveirosApi } from '@/services/viveiros'
import { ApiError } from '@/services/api'
import { calendarDateValid, formatDate, formatMeasure, today } from '@/utils/viveiros'
import type { CicloCultivo } from '@/types/viveiro'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()
const { viveiro, loading, errorMessage: loadError, notFound, load } = useViveiro(() => props.id)
const detailRoute = computed(() => ({ name: 'detalhes-viveiro', params: { id: props.id } }))
const canOpen = computed(() => viveiro.value?.status === 'DISPONIVEL' && !viveiro.value.cicloAtivo)
const form = reactive({
  dataInicio: today(),
  qtdLarvasInicial: '',
  fornecedorLarvas: '',
  previsaoDespesca: '',
})
const errors = reactive({
  dataInicio: '',
  qtdLarvasInicial: '',
  fornecedorLarvas: '',
  previsaoDespesca: '',
})
type FieldName = keyof typeof form
const fields: Partial<Record<FieldName, { focus: () => void }>> = {}
const submitting = ref(false)
const errorMessage = ref('')
const created = ref<CicloCultivo | null>(null)
const successHeading = ref<HTMLElement>()
watch(
  () => props.id,
  () => {
    created.value = null
    errorMessage.value = ''
    for (const name of Object.keys(errors) as FieldName[]) {
      errors[name] = ''
      form[name] = name === 'dataInicio' ? today() : ''
    }
  },
)
async function focusError() {
  await nextTick()
  const first = (Object.keys(errors) as FieldName[]).find((name) => errors[name])
  if (first) fields[first]?.focus()
}
async function submit() {
  if (submitting.value || !canOpen.value) return
  errorMessage.value = ''
  errors.dataInicio = !form.dataInicio
    ? 'Informe a data de início.'
    : !calendarDateValid(form.dataInicio)
      ? 'Informe uma data válida.'
      : ''
  const quantity = Number(form.qtdLarvasInicial.trim())
  errors.qtdLarvasInicial = !form.qtdLarvasInicial.trim()
    ? 'Informe a quantidade inicial de larvas.'
    : !/^\d+$/.test(form.qtdLarvasInicial.trim()) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 2147483647
      ? 'Informe um inteiro entre 1 e 2147483647.'
      : ''
  errors.fornecedorLarvas =
    form.fornecedorLarvas.trim().length > 160 ? 'Use até 160 caracteres.' : ''
  errors.previsaoDespesca =
    form.previsaoDespesca && !calendarDateValid(form.previsaoDespesca)
      ? 'Informe uma data válida.'
      : form.previsaoDespesca && form.previsaoDespesca < form.dataInicio
        ? 'A previsão não pode ser anterior ao início do ciclo.'
        : ''
  if (Object.values(errors).some(Boolean)) {
    await focusError()
    return
  }
  submitting.value = true
  try {
    const result = await viveirosApi.openCycle(props.id, {
      dataInicio: form.dataInicio,
      qtdLarvasInicial: quantity,
      fornecedorLarvas: form.fornecedorLarvas.trim() || null,
      previsaoDespesca: form.previsaoDespesca || null,
    })
    created.value = result.ciclo
    await nextTick()
    successHeading.value?.focus()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return
    if (error instanceof ApiError && error.status === 403) {
      await router.replace('/acesso-negado')
      return
    }
    errorMessage.value = error instanceof Error ? error.message : 'Não foi possível abrir o ciclo.'
    if (error instanceof ApiError && [404, 409].includes(error.status)) await load()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <RouterLink :to="detailRoute" class="text-link back-link"
    ><ArrowLeft :size="16" />{{ viveiro?.identificador || 'Detalhes do viveiro' }}</RouterLink
  >
  <div class="page-intro">
    <div>
      <h1>Abrir ciclo</h1>
    </div>
  </div>
  <BaseAlert
    v-if="errorMessage"
    title="Não foi possível abrir o ciclo"
    tone="error"
    class="form-notice"
    >{{ errorMessage }}</BaseAlert
  >
  <BaseLoading v-if="loading" label="Verificando disponibilidade do viveiro…" />
  <section v-else-if="notFound" class="data-panel panel-feedback">
    <BaseAlert title="Viveiro não encontrado" tone="error"
      >Confira o viveiro e tente novamente.</BaseAlert
    ><BaseButton to="/viveiros" variant="secondary">Ver viveiros</BaseButton>
  </section>
  <section v-else-if="loadError" class="data-panel panel-feedback">
    <BaseAlert title="Não foi possível carregar o viveiro" tone="error">{{ loadError }}</BaseAlert
    ><BaseButton variant="secondary" @click="load">Tentar novamente</BaseButton>
  </section>
  <section
    v-else-if="created"
    class="data-panel success-panel"
    aria-labelledby="cycle-success-heading"
  >
    <span class="success-icon"><Check :size="26" /></span>
    <h2 id="cycle-success-heading" ref="successHeading" tabindex="-1">Ciclo iniciado</h2>
    <dl class="record-details">
      <div>
        <dt>Início</dt>
        <dd>{{ formatDate(created.dataInicio) }}</dd>
      </div>
      <div>
        <dt>Larvas iniciais</dt>
        <dd>{{ formatMeasure(created.qtdLarvasInicial) }}</dd>
      </div>
    </dl>
    <div class="form-actions">
      <BaseButton :to="detailRoute">Ver detalhes do viveiro</BaseButton>
    </div>
  </section>
  <section v-else-if="viveiro && !canOpen" class="data-panel panel-feedback">
    <BaseAlert title="Viveiro indisponível para um novo ciclo">{{
      viveiro.cicloAtivo
        ? 'Este viveiro já possui um ciclo ativo. Consulte os detalhes para acompanhar o cultivo.'
        : 'O viveiro precisa estar disponível para iniciar um ciclo.'
    }}</BaseAlert
    ><BaseButton :to="detailRoute" variant="secondary">Ver detalhes do viveiro</BaseButton>
  </section>
  <div v-else-if="viveiro" class="pond-form-layout">
    <section class="data-panel pond-form-panel" aria-labelledby="cycle-form-heading">
      <div class="pond-panel-heading">
        <h2 id="cycle-form-heading">Dados do povoamento</h2>
        <p>Os campos com * são obrigatórios.</p>
      </div>
      <form class="form-stack" novalidate :aria-busy="submitting" @submit.prevent="submit">
        <div class="form-columns">
          <BaseField
            :ref="
              (el) => {
                if (el) fields.dataInicio = el as InstanceType<typeof BaseField>
              }
            "
            v-model="form.dataInicio"
            label="Data de início"
            name="dataInicio"
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            :error="errors.dataInicio"
            :disabled="submitting"
            required
          /><BaseField
            :ref="
              (el) => {
                if (el) fields.qtdLarvasInicial = el as InstanceType<typeof BaseField>
              }
            "
            v-model="form.qtdLarvasInicial"
            label="Quantidade inicial de larvas"
            name="qtdLarvasInicial"
            inputmode="numeric"
            placeholder="Ex.: 120000"
            hint="Informe a quantidade, sem separador de milhar."
            :maxlength="10"
            :error="errors.qtdLarvasInicial"
            :disabled="submitting"
            required
          />
        </div>
        <BaseField
          :ref="
            (el) => {
              if (el) fields.fornecedorLarvas = el as InstanceType<typeof BaseField>
            }
          "
          v-model="form.fornecedorLarvas"
          label="Fornecedor de larvas (opcional)"
          name="fornecedorLarvas"
          :maxlength="160"
          :error="errors.fornecedorLarvas"
          :disabled="submitting"
        />
        <BaseField
          :ref="
            (el) => {
              if (el) fields.previsaoDespesca = el as InstanceType<typeof BaseField>
            }
          "
          v-model="form.previsaoDespesca"
          label="Previsão de despesca (opcional)"
          name="previsaoDespesca"
          type="date"
          :min="form.dataInicio || '0001-01-01'"
          max="9999-12-31"
          :error="errors.previsaoDespesca"
          :disabled="submitting"
        />
        <div class="form-actions">
          <BaseButton type="submit" :loading="submitting"
            ><Sprout v-if="!submitting" :size="17" />{{
              submitting ? 'Iniciando…' : 'Iniciar ciclo'
            }}</BaseButton
          ><BaseButton :to="detailRoute" variant="ghost" :disabled="submitting"
            >Cancelar</BaseButton
          >
        </div>
      </form>
    </section>
  </div>
</template>
