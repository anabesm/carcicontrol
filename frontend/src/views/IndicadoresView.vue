<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { indicadoresApi, type Resumo, type Evolucao } from '@/services/indicadores'
import { apiRequest } from '@/services/api'
import { useResource } from '@/composables/useResource'
import { useAuthStore } from '@/stores/auth'
import { currency, queryString } from '@/utils/records'
import type { ParametroConfiguravel } from '@/services/faixas'
import CultivoFilter from '@/components/records/CultivoFilter.vue'
import MeasurementChart from '@/components/medicoes/MeasurementChart.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
const auth = useAuthStore()
const filter = reactive({ viveiroId: '', cicloId: '', inicio: '', fim: '' })
const parameters = ref<ParametroConfiguravel[]>([])
const parametroId = ref('')
const catalogError = ref('')
const summary = useResource(
  () => indicadoresApi.summary(queryString(filter)),
  null as Resumo | null,
)
const evolution = useResource(
  () => indicadoresApi.evolution(queryString({ ...filter, parametroId: parametroId.value })),
  null as Evolucao | null,
)
async function refresh() {
  await summary.load()
  if (filter.cicloId && parametroId.value) await evolution.load()
}
watch([() => filter.cicloId, parametroId], () => {
  evolution.data.value = null
  if (filter.cicloId && parametroId.value) void evolution.load()
})
onMounted(async () => {
  void summary.load()
  try {
    parameters.value = (
      await apiRequest<{ parametros: ParametroConfiguravel[] }>('/parametros/catalogo')
    ).parametros
    parametroId.value = String(parameters.value[0]?.id ?? '')
  } catch (cause) {
    catalogError.value =
      cause instanceof Error ? cause.message : 'Não foi possível carregar os parâmetros.'
  }
})
</script>
<template>
  <div class="page-intro">
    <h1>Indicadores do cultivo</h1>
    <BaseButton variant="secondary" :disabled="summary.loading.value" @click="refresh"
      >Atualizar</BaseButton
    >
  </div>
  <section class="data-panel record-panel">
    <form class="form-stack" @submit.prevent="refresh">
      <CultivoFilter v-model:viveiro-id="filter.viveiroId" v-model:ciclo-id="filter.cicloId" />
      <div class="form-columns">
        <BaseField v-model="filter.inicio" label="De" type="date" /><BaseField
          v-model="filter.fim"
          label="Até"
          type="date"
        />
      </div>
      <div>
        <BaseButton variant="secondary" type="submit" :disabled="summary.loading.value"
          >Aplicar filtros</BaseButton
        >
      </div>
    </form>
    <BaseLoading v-if="summary.loading.value" /><BaseAlert
      v-else-if="summary.error.value"
      tone="error"
      title="Não foi possível carregar os indicadores"
      >{{ summary.error.value }}</BaseAlert
    >
    <template v-else-if="summary.data.value"
      ><h2>Situação atual</h2>
      <dl class="metrics-grid">
        <div>
          <dt>Viveiros disponíveis</dt>
          <dd>{{ summary.data.value.viveiros.DISPONIVEL }}</dd>
        </div>
        <div>
          <dt>Viveiros ocupados</dt>
          <dd>{{ summary.data.value.viveiros.OCUPADO }}</dd>
        </div>
        <div>
          <dt>Ciclos ativos</dt>
          <dd>{{ summary.data.value.ciclosAtivos }}</dd>
        </div>
        <div>
          <dt>Alertas pendentes</dt>
          <dd>{{ summary.data.value.alertasPendentes }}</dd>
        </div>
      </dl>
      <template v-if="auth.isAdmin && summary.data.value.financeiro"
        ><h2>Financeiro do período</h2>
        <dl class="metrics-grid">
          <div>
            <dt>Despesas registradas</dt>
            <dd>{{ currency(summary.data.value.financeiro.despesas) }}</dd>
          </div>
          <div>
            <dt>Receitas de vendas</dt>
            <dd>{{ currency(summary.data.value.financeiro.receitas) }}</dd>
          </div>
          <div>
            <dt>Saldo registrado</dt>
            <dd>{{ currency(summary.data.value.financeiro.saldoRegistrado) }}</dd>
          </div>
          <div>
            <dt>Peso vendido</dt>
            <dd>{{ summary.data.value.financeiro.pesoVendidoKg.toLocaleString('pt-BR') }} kg</dd>
          </div>
        </dl></template
      >
    </template>
  </section>
  <section class="data-panel record-panel">
    <h2>Evolução das medições</h2>
    <BaseAlert v-if="catalogError" tone="error" title="Parâmetros indisponíveis">{{
      catalogError
    }}</BaseAlert>
    <BaseSelect v-model="parametroId" label="Parâmetro" name="parametroId"
      ><option v-for="parameter in parameters" :key="parameter.id" :value="String(parameter.id)">
        {{ parameter.nome }} ({{ parameter.unidadePadrao }})
      </option></BaseSelect
    >
    <p v-if="!filter.cicloId" class="empty-message">
      Selecione um viveiro e um ciclo para consultar a evolução.
    </p>
    <BaseLoading v-else-if="evolution.loading.value" /><BaseAlert
      v-else-if="evolution.error.value"
      title="Não foi possível carregar o gráfico"
      tone="error"
      >{{ evolution.error.value }}</BaseAlert
    >
    <template v-else-if="evolution.data.value"
      ><p v-if="evolution.data.value.truncado">
        Exibindo as primeiras 500 medições. Reduza o período para consultar os demais registros.
      </p>
      <MeasurementChart
        :points="evolution.data.value.medicoes"
        :name="evolution.data.value.parametro.nome"
        :unit="evolution.data.value.parametro.unidadePadrao"
    /></template>
  </section>
</template>
