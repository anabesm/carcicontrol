<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { medicoesApi } from '@/services/medicoes'
import { ApiError } from '@/services/api'
import type { PaginaAlertas, PaginaMedicoes } from '@/types/medicao'
import { formatDateTime, formatReading } from '@/utils/medicoes'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const props = defineProps<{ cicloId: number; refresh: number }>()
const history = ref<PaginaMedicoes | null>(null)
const alerts = ref<PaginaAlertas | null>(null)
const loadingHistory = ref(true)
const loadingAlerts = ref(true)
const historyError = ref('')
const alertsError = ref('')
let historyVersion = 0
let alertsVersion = 0
let historyOffset = 0
let alertsOffset = 0
const statuses = { PENDENTE: 'Pendente', RESOLVIDO: 'Resolvido', IGNORADO: 'Ignorado' }
const severities = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' }

async function loadHistory(offset = historyOffset) {
  const version = ++historyVersion
  historyOffset = offset
  loadingHistory.value = true
  historyError.value = ''
  try {
    const result = await medicoesApi.list(props.cicloId, offset)
    if (version === historyVersion) history.value = result
  } catch (error) {
    if (version === historyVersion && !(error instanceof ApiError && error.status === 401))
      historyError.value =
        error instanceof Error ? error.message : 'Não foi possível carregar as medições.'
  } finally {
    if (version === historyVersion) loadingHistory.value = false
  }
}
async function loadAlerts(offset = alertsOffset) {
  const version = ++alertsVersion
  alertsOffset = offset
  loadingAlerts.value = true
  alertsError.value = ''
  try {
    const result = await medicoesApi.alerts(props.cicloId, offset)
    if (version === alertsVersion) alerts.value = result
  } catch (error) {
    if (version === alertsVersion && !(error instanceof ApiError && error.status === 401))
      alertsError.value =
        error instanceof Error ? error.message : 'Não foi possível carregar os alertas.'
  } finally {
    if (version === alertsVersion) loadingAlerts.value = false
  }
}
watch(
  () => [props.cicloId, props.refresh],
  () => {
    history.value = null
    alerts.value = null
    void loadHistory(0)
    void loadAlerts(0)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  historyVersion++
  alertsVersion++
})
</script>

<template>
  <section
    class="data-panel measurement-history-panel"
    aria-labelledby="measurement-history-heading"
  >
    <div class="list-toolbar">
      <h2 id="measurement-history-heading">Histórico de medições</h2>
      <span v-if="history && !loadingHistory && !historyError" class="record-count"
        >{{ history.total }} {{ history.total === 1 ? 'registro' : 'registros' }}</span
      >
    </div>
    <BaseLoading v-if="loadingHistory" label="Carregando medições…" />
    <div v-else-if="historyError" class="panel-feedback">
      <BaseAlert title="Não foi possível carregar as medições" tone="error">{{
        historyError
      }}</BaseAlert>
      <BaseButton variant="secondary" @click="loadHistory()">Tentar novamente</BaseButton>
    </div>
    <template v-else-if="history">
      <p v-if="!history.total" class="empty-measurements">
        Nenhuma medição registrada neste ciclo.
      </p>
      <table v-else class="measurement-table">
        <caption class="sr-only">
          Medições do ciclo #{{
            cicloId
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Parâmetro</th>
            <th scope="col">Data e hora</th>
            <th scope="col">Valor</th>
            <th scope="col">Faixa ideal</th>
            <th scope="col">Responsável</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in history.medicoes" :key="item.id">
            <td class="measurement-parameter">{{ item.parametro.nome }}</td>
            <td data-label="Data e hora">
              <time :datetime="item.medidoEm">{{ formatDateTime(item.medidoEm) }}</time>
            </td>
            <td data-label="Valor" class="measurement-value">
              {{ formatReading(item.valor) }} {{ item.unidade }}
            </td>
            <td data-label="Faixa ideal">
              <span v-if="item.faixaAplicada"
                >{{ formatReading(item.faixaAplicada.minIdeal) }} a
                {{ formatReading(item.faixaAplicada.maxIdeal) }} {{ item.unidade
                }}<small v-if="item.faixaAplicada.demonstrativa" class="range-example"
                  >Exemplo</small
                ></span
              ><span v-else>Não registrada</span>
            </td>
            <td data-label="Responsável">{{ item.registradoPor.nome }}</td>
            <td data-label="Situação">
              <StatusBadge
                :label="
                  item.confirmadaForaFaixa
                    ? 'Anomalia confirmada'
                    : item.faixaAplicada
                      ? 'Na faixa ideal'
                      : 'Registrada'
                "
                :tone="item.confirmadaForaFaixa ? 'warning' : 'neutral'"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <nav
        v-if="history.total > history.limite"
        class="measurement-pagination"
        aria-label="Páginas do histórico"
      >
        <span
          >{{ history.offset + 1 }}–{{
            Math.min(history.offset + history.limite, history.total)
          }}
          de {{ history.total }}</span
        >
        <div>
          <BaseButton
            size="small"
            variant="secondary"
            :disabled="history.offset === 0"
            @click="loadHistory(Math.max(0, history.offset - history.limite))"
            >Anteriores</BaseButton
          ><BaseButton
            size="small"
            variant="secondary"
            :disabled="history.offset + history.limite >= history.total"
            @click="loadHistory(history.offset + history.limite)"
            >Próximas</BaseButton
          >
        </div>
      </nav>
    </template>
  </section>
  <section
    class="data-panel measurement-history-panel"
    aria-labelledby="measurement-alerts-heading"
  >
    <div class="list-toolbar">
      <h2 id="measurement-alerts-heading">Alertas</h2>
      <span v-if="alerts && !loadingAlerts && !alertsError" class="record-count"
        >{{ alerts.total }} {{ alerts.total === 1 ? 'alerta' : 'alertas' }}</span
      >
    </div>
    <BaseLoading v-if="loadingAlerts" label="Carregando alertas…" />
    <div v-else-if="alertsError" class="panel-feedback">
      <BaseAlert title="Não foi possível carregar os alertas" tone="error">{{
        alertsError
      }}</BaseAlert
      ><BaseButton variant="secondary" @click="loadAlerts()">Tentar novamente</BaseButton>
    </div>
    <template v-else-if="alerts">
      <p v-if="!alerts.total" class="empty-measurements">Nenhum alerta registrado neste ciclo.</p>
      <ul v-else class="measurement-alert-list">
        <li v-for="item in alerts.alertas" :key="item.id">
          <div class="measurement-alert-heading">
            <h3>
              {{ item.medicao.parametro.nome }} · {{ formatReading(item.valorMedido) }}
              {{ item.medicao.unidade }}
            </h3>
            <StatusBadge
              :label="statuses[item.status]"
              :tone="item.status === 'PENDENTE' ? 'warning' : 'neutral'"
            />
          </div>
          <p class="measurement-alert-limit">{{ item.limiteViolado }}</p>
          <dl class="measurement-alert-meta">
            <div>
              <dt>Medição</dt>
              <dd>{{ formatDateTime(item.medicao.medidoEm) }}</dd>
            </div>
            <div>
              <dt>Responsável</dt>
              <dd>{{ item.medicao.registradoPor.nome }}</dd>
            </div>
            <div>
              <dt>Gravidade</dt>
              <dd>{{ severities[item.gravidade] }}</dd>
            </div>
          </dl>
          <p v-if="item.medicao.faixaAplicada" class="measurement-alert-range">
            Faixa ideal{{ item.medicao.faixaAplicada.demonstrativa ? ' (exemplo)' : '' }}:
            {{ formatReading(item.medicao.faixaAplicada.minIdeal) }} a
            {{ formatReading(item.medicao.faixaAplicada.maxIdeal) }} {{ item.medicao.unidade }}
          </p>
        </li>
      </ul>
      <nav
        v-if="alerts.total > alerts.limite"
        class="measurement-pagination"
        aria-label="Páginas dos alertas"
      >
        <span
          >{{ alerts.offset + 1 }}–{{ Math.min(alerts.offset + alerts.limite, alerts.total) }} de
          {{ alerts.total }}</span
        >
        <div>
          <BaseButton
            size="small"
            variant="secondary"
            :disabled="alerts.offset === 0"
            @click="loadAlerts(Math.max(0, alerts.offset - alerts.limite))"
            >Anteriores</BaseButton
          ><BaseButton
            size="small"
            variant="secondary"
            :disabled="alerts.offset + alerts.limite >= alerts.total"
            @click="loadAlerts(alerts.offset + alerts.limite)"
            >Próximos</BaseButton
          >
        </div>
      </nav>
    </template>
  </section>
</template>
