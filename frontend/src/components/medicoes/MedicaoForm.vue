<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { medicoesApi } from '@/services/medicoes'
import { ApiError } from '@/services/api'
import type { ConfirmacaoAnomalia, Medicao, NovaMedicao, Parametro } from '@/types/medicao'
import type { CicloCultivo } from '@/types/viveiro'
import {
  anomalyDetails,
  decimalValue,
  formatDateTime,
  formatReading,
  localDateTime,
  measurementTimestamp,
} from '@/utils/medicoes'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'

const props = defineProps<{ ciclo: CicloCultivo; viveiro: string }>()
const emit = defineEmits<{ saved: [medicao: Medicao]; busy: [value: boolean]; attempt: [] }>()
const parameters = ref<Parametro[]>([])
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const form = reactive({ parametroId: '', valor: '', medidoEm: localDateTime() })
const errors = reactive({ parametroId: '', valor: '', medidoEm: '' })
const parameterField = ref<InstanceType<typeof BaseSelect>>()
const valueField = ref<InstanceType<typeof BaseField>>()
const timeField = ref<InstanceType<typeof BaseField>>()
const confirmation = ref<HTMLElement>()
const pending = ref<{ input: NovaMedicao; details: ConfirmacaoAnomalia } | null>(null)
const parameter = computed(() =>
  parameters.value.find((item) => item.id === Number(form.parametroId)),
)
const locked = computed(() => submitting.value || !!pending.value)
watch(locked, (value) => emit('busy', value))
let mounted = true
let loadVersion = 0
onBeforeUnmount(() => {
  mounted = false
})

async function load(useTime = false) {
  const version = ++loadVersion
  loading.value = true
  loadError.value = ''
  try {
    const timestamp = measurementTimestamp(form.medidoEm)
    const result =
      useTime && timestamp
        ? await medicoesApi.parameters(props.ciclo.id, timestamp)
        : await medicoesApi.parameters(props.ciclo.id)
    if (mounted && version === loadVersion) parameters.value = result.parametros
  } catch (error) {
    if (mounted && version === loadVersion && !(error instanceof ApiError && error.status === 401))
      loadError.value =
        error instanceof Error ? error.message : 'Não foi possível carregar os parâmetros.'
  } finally {
    if (mounted && version === loadVersion) loading.value = false
  }
}
onMounted(load)

async function correct() {
  pending.value = null
  errorMessage.value = ''
  await nextTick()
  valueField.value?.focus()
}

async function save(input: NovaMedicao) {
  submitting.value = true
  errorMessage.value = ''
  try {
    const result = await medicoesApi.create(input)
    if (!mounted) return
    pending.value = null
    form.valor = ''
    form.medidoEm = localDateTime()
    emit('saved', result.medicao)
    await nextTick()
    valueField.value?.focus()
  } catch (error) {
    if (!mounted || (error instanceof ApiError && error.status === 401)) return
    const details =
      error instanceof ApiError && error.status === 409
        ? anomalyDetails(error.detalhes, input)
        : null
    if (details) {
      pending.value = { input: { ...input, confirmarAnomalia: false }, details }
      await nextTick()
      confirmation.value?.focus()
    } else {
      // Uma falha não autoriza repetir o registro com confirmação automática.
      pending.value = null
      errorMessage.value =
        error instanceof Error ? error.message : 'Não foi possível registrar a medição.'
    }
  } finally {
    if (mounted) submitting.value = false
  }
}

async function submit() {
  if (locked.value || props.ciclo.status !== 'ATIVO') return
  emit('attempt')
  errorMessage.value = ''
  const selected = parameter.value
  const value = decimalValue(form.valor)
  const timestamp = measurementTimestamp(form.medidoEm)
  errors.parametroId = selected ? '' : 'Selecione o parâmetro.'
  errors.valor = !form.valor.trim()
    ? 'Informe o valor medido.'
    : value === null
      ? 'Informe um número válido, sem separador de milhar.'
      : selected && (value < selected.minPossivel || value > selected.maxPossivel)
        ? `Informe um valor entre ${formatReading(selected.minPossivel)} e ${formatReading(selected.maxPossivel)} ${selected.unidadePadrao}.`
        : ''
  errors.medidoEm = !form.medidoEm
    ? 'Informe a data e hora da medição.'
    : !timestamp
      ? 'Informe uma data e hora válidas.'
      : new Date(timestamp) > new Date()
        ? 'A medição não pode estar no futuro.'
        : new Date(timestamp) < new Date(props.ciclo.dataInicio)
          ? 'A medição não pode ser anterior ao início do ciclo.'
          : ''
  if (Object.values(errors).some(Boolean)) {
    await nextTick()
    if (errors.parametroId) parameterField.value?.focus()
    else if (errors.valor) valueField.value?.focus()
    else timeField.value?.focus()
    return
  }
  if (!selected || value === null || !timestamp) return
  await save({
    cicloId: props.ciclo.id,
    parametroId: selected.id,
    valor: value,
    unidade: selected.unidadePadrao,
    medidoEm: timestamp,
  })
}

async function confirm() {
  if (!pending.value || submitting.value) return
  await save({ ...pending.value.input, confirmarAnomalia: true })
}
</script>

<template>
  <section class="data-panel measurement-form-panel" aria-labelledby="measurement-form-heading">
    <h2 id="measurement-form-heading">Registrar medição</h2>
    <BaseLoading v-if="loading" label="Carregando parâmetros…" />
    <div v-else-if="loadError" class="panel-feedback">
      <BaseAlert title="Não foi possível carregar os parâmetros" tone="error">{{
        loadError
      }}</BaseAlert>
      <BaseButton variant="secondary" @click="load">Tentar novamente</BaseButton>
    </div>
    <p v-else-if="!parameters.length" class="empty-measurements">
      Nenhum parâmetro disponível para registro.
    </p>
    <template v-else>
      <BaseAlert
        v-if="errorMessage"
        title="Não foi possível registrar a medição"
        tone="error"
        class="form-notice"
        >{{ errorMessage }}</BaseAlert
      >
      <div
        v-if="pending"
        ref="confirmation"
        class="anomaly-confirmation"
        role="alertdialog"
        aria-labelledby="anomaly-heading"
        aria-describedby="anomaly-description"
        tabindex="-1"
      >
        <h3 id="anomaly-heading">Valor fora da faixa ideal</h3>
        <p id="anomaly-description">
          A medição ainda não foi salva. Confirme para registrar o valor e gerar um alerta.
        </p>
        <dl class="record-details confirmation-details">
          <div>
            <dt>Viveiro / ciclo</dt>
            <dd>{{ viveiro }} · Ciclo #{{ ciclo.id }}</dd>
          </div>
          <div>
            <dt>Parâmetro</dt>
            <dd>{{ pending.details.parametro.nome }}</dd>
          </div>
          <div>
            <dt>Valor informado</dt>
            <dd class="anomaly-value">
              {{ formatReading(pending.details.valor) }} {{ pending.details.unidade }}
            </dd>
          </div>
          <div>
            <dt>Faixa ideal{{ pending.details.faixaIdeal.demonstrativa ? ' (exemplo)' : '' }}</dt>
            <dd>
              {{ formatReading(pending.details.faixaIdeal.minIdeal) }} a
              {{ formatReading(pending.details.faixaIdeal.maxIdeal) }} {{ pending.details.unidade }}
            </dd>
          </div>
          <div>
            <dt>Data e hora da medição</dt>
            <dd>{{ formatDateTime(pending.details.medidoEm) }}</dd>
          </div>
        </dl>
        <div class="form-actions">
          <BaseButton variant="secondary" :disabled="submitting" @click="correct"
            >Corrigir valor</BaseButton
          >
          <BaseButton :loading="submitting" @click="confirm">{{
            submitting ? 'Salvando…' : 'Confirmar e salvar'
          }}</BaseButton>
        </div>
      </div>
      <form v-else class="form-stack" novalidate :aria-busy="submitting" @submit.prevent="submit">
        <div class="measurement-fields">
          <BaseSelect
            ref="parameterField"
            v-model="form.parametroId"
            name="parametroId"
            label="Parâmetro"
            required
            :disabled="submitting"
            :error="errors.parametroId"
          >
            <option value="" disabled>Selecione</option>
            <option v-for="item in parameters" :key="item.id" :value="String(item.id)">
              {{ item.nome }} ({{ item.unidadePadrao }})
            </option>
          </BaseSelect>
          <BaseField
            ref="valueField"
            v-model="form.valor"
            label="Valor medido"
            name="valor"
            inputmode="decimal"
            autocomplete="off"
            required
            :disabled="submitting"
            :error="errors.valor"
            :maxlength="24"
          >
            <template v-if="parameter" #trailing>{{ parameter.unidadePadrao }}</template>
          </BaseField>
          <BaseField
            ref="timeField"
            v-model="form.medidoEm"
            label="Data e hora da medição"
            name="medidoEm"
            @change="load(true)"
            type="datetime-local"
            min="0001-01-01T00:00"
            max="9999-12-31T23:59"
            required
            :disabled="submitting"
            :error="errors.medidoEm"
          />
        </div>
        <p v-if="parameter" class="measurement-range">
          Faixa ideal{{ parameter.faixaIdeal.demonstrativa ? ' (exemplo)' : '' }}:
          <strong
            >{{ formatReading(parameter.faixaIdeal.minIdeal) }} a
            {{ formatReading(parameter.faixaIdeal.maxIdeal) }} {{ parameter.unidadePadrao }}</strong
          >
        </p>
        <div class="form-actions">
          <BaseButton type="submit" :loading="submitting">{{
            submitting ? 'Salvando…' : 'Registrar medição'
          }}</BaseButton>
        </div>
      </form>
    </template>
  </section>
</template>
