<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useViveiro } from '@/composables/useViveiro'
import { viveirosApi } from '@/services/viveiros'
import { currency, decimal, localNow } from '@/utils/records'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
const props = defineProps<{ id: string; cicloId: string }>()
const router = useRouter()
const { viveiro, loading, errorMessage, load } = useViveiro(() => props.id)
const active = computed(() => viveiro.value?.cicloAtivo?.id === Number(props.cicloId))
const form = reactive({
  motivo: 'VENDA',
  dataEncerramento: localNow(),
  compradorNome: '',
  pesoTotalKg: '',
  precoPorKg: '',
  quantidadeFinal: '',
  biometria: '',
  observacao: '',
  justificativa: '',
})
const pending = ref<Record<string, unknown> | null>(null)
const saving = ref(false)
const error = ref('')
const receita = computed(() => decimal(form.pesoTotalKg) * decimal(form.precoPorKg) || 0)
function prepare() {
  error.value = ''
  if (!Number.isFinite(new Date(form.dataEncerramento).getTime())) {
    error.value = 'Informe uma data/hora válida.'
    return
  }
  if (
    form.motivo === 'VENDA' &&
    (!form.compradorNome.trim() ||
      !(decimal(form.pesoTotalKg) > 0) ||
      !(decimal(form.precoPorKg) > 0))
  ) {
    error.value = 'Informe comprador, peso e preço positivos.'
    return
  }
  if (form.motivo === 'PERDA_TOTAL' && !form.justificativa.trim()) {
    error.value = 'Informe a justificativa da perda total.'
    return
  }
  pending.value = {
    motivo: form.motivo,
    dataEncerramento: new Date(form.dataEncerramento).toISOString(),
    observacao: form.observacao || null,
    ...(form.motivo === 'VENDA'
      ? {
          compradorNome: form.compradorNome,
          pesoTotalKg: decimal(form.pesoTotalKg),
          precoPorKg: decimal(form.precoPorKg),
          biometria: form.biometria || null,
          quantidadeFinal: form.quantidadeFinal ? decimal(form.quantidadeFinal) : null,
        }
      : { justificativa: form.justificativa }),
  }
}
async function save() {
  if (!pending.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await viveirosApi.closeCycle(props.id, props.cicloId, pending.value)
    await router.replace(`/viveiros/${props.id}`)
  } catch (cause) {
    pending.value = null
    error.value = cause instanceof Error ? cause.message : 'Não foi possível encerrar.'
    await load()
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <RouterLink :to="`/viveiros/${id}`" class="text-link back-link">Voltar ao viveiro</RouterLink>
  <div class="page-intro">
    <h1>Encerrar ciclo #{{ cicloId }}</h1>
  </div>
  <BaseLoading v-if="loading" />
  <BaseAlert v-else-if="errorMessage" title="Não foi possível carregar" tone="error">{{
    errorMessage
  }}</BaseAlert>
  <BaseAlert v-else-if="!active" title="Ciclo indisponível" tone="error"
    >Este ciclo não está ativo neste viveiro.</BaseAlert
  >
  <section v-else class="data-panel record-panel">
    <h2>{{ viveiro?.identificador }}</h2>
    <BaseAlert v-if="error" title="Não foi possível encerrar" tone="error">{{ error }}</BaseAlert>
    <form class="form-stack" @submit.prevent="prepare">
      <div class="form-columns">
        <BaseSelect v-model="form.motivo" name="motivo" label="Motivo" :disabled="saving"
          ><option value="VENDA">Venda / despesca</option>
          <option value="PERDA_TOTAL">Perda total</option></BaseSelect
        ><BaseField
          v-model="form.dataEncerramento"
          type="datetime-local"
          label="Data e hora do encerramento"
          required
          :disabled="saving"
        />
      </div>
      <template v-if="form.motivo === 'VENDA'"
        ><BaseField
          v-model="form.compradorNome"
          label="Comprador"
          required
          :maxlength="160"
          :disabled="saving"
        />
        <div class="form-columns">
          <BaseField
            v-model="form.pesoTotalKg"
            label="Peso total (kg)"
            inputmode="decimal"
            required
            :disabled="saving"
          /><BaseField
            v-model="form.precoPorKg"
            label="Preço por kg (R$)"
            inputmode="decimal"
            required
            :disabled="saving"
          />
        </div>
        <div class="form-columns">
          <BaseField
            v-model="form.quantidadeFinal"
            label="Quantidade final de camarões (opcional)"
            inputmode="numeric"
            :disabled="saving"
          /><BaseField
            v-model="form.biometria"
            label="Biometria (opcional)"
            :maxlength="240"
            :disabled="saving"
          />
        </div>
        <strong>Receita: {{ currency(receita) }}</strong></template
      >
      <template v-else
        ><BaseField
          v-model="form.justificativa"
          label="Justificativa da perda total"
          required
          :maxlength="2000"
          :disabled="saving"
        /><strong>Receita: {{ currency(0) }}</strong></template
      >
      <BaseField
        v-model="form.observacao"
        label="Observação"
        :maxlength="2000"
        :disabled="saving"
      />
      <div class="form-actions">
        <BaseButton type="submit" :disabled="saving">Revisar encerramento</BaseButton
        ><BaseButton :to="`/viveiros/${id}`" variant="secondary">Cancelar</BaseButton>
      </div>
    </form>
  </section>
  <ConfirmDialog
    :open="Boolean(pending)"
    title="Confirmar encerramento"
    :busy="saving"
    confirm-label="Encerrar ciclo"
    @cancel="pending = null"
    @confirm="save"
    ><p>
      <strong>{{ viveiro?.identificador }} — ciclo #{{ cicloId }}</strong>
    </p>
    <p>{{ form.motivo === 'VENDA' ? 'Venda / despesca' : 'Perda total' }}</p>
    <p v-if="form.motivo === 'VENDA'">
      {{ form.pesoTotalKg }} kg para {{ form.compradorNome }}. Receita:
      <strong>{{ currency(receita) }}</strong
      >.
    </p>
    <p v-else>
      {{ form.justificativa }}. Receita: <strong>{{ currency(0) }}</strong
      >.
    </p>
    <p>O ciclo será encerrado e o viveiro ficará disponível.</p></ConfirmDialog
  >
</template>
