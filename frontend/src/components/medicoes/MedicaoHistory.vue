<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { medicoesApi } from '@/services/medicoes'
import { ApiError } from '@/services/api'
import type { AlertaComMedicao, PaginaAlertas, PaginaMedicoes } from '@/types/medicao'
import { formatDateTime, formatReading } from '@/utils/medicoes'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseField from '@/components/ui/BaseField.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ cicloId: number; refresh: number }>()
const auth = useAuthStore()
const alertStatus = ref('')
const pending = ref<{ item: AlertaComMedicao; status: 'RESOLVIDO' | 'IGNORADO' } | null>(null)
const observation = ref(''),
  actionError = ref('')
const resolving = ref(false)
function prepareResolution(item: AlertaComMedicao, status: 'RESOLVIDO' | 'IGNORADO') {
  pending.value = { item, status }
  observation.value = ''
  actionError.value = ''
}
async function resolveAlert() {
  if (!pending.value || resolving.value) return
  actionError.value = ''
  if (!observation.value.trim()) {
    actionError.value = 'Informe a justificativa.'
    return
  }
  resolving.value = true
  try {
    await medicoesApi.resolveAlert(pending.value.item.id, pending.value.status, observation.value)
    pending.value = null
    await Promise.all([loadAlerts(), loadHistory()])
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : 'Não foi possível tratar o alerta.'
    if (cause instanceof ApiError && cause.status === 409) {
      pending.value = null
      await loadAlerts()
    }
  } finally {
    resolving.value = false
  }
}
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
    const result = await medicoesApi.alerts(props.cicloId, offset, alertStatus.value)
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
    pending.value = null
    void loadHistory(0)
    void loadAlerts(0)
  },
  { immediate: true },
)
watch(alertStatus, () => {
  void loadAlerts(0)
})
watch([loadingHistory, loadingAlerts], async ([historyLoading, alertsLoading]) => {
  if (!historyLoading && !alertsLoading && window.location.hash === '#alertas') {
    await nextTick()
    document.getElementById('alertas')?.scrollIntoView({ block: 'start' })
  }
})
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
    id="alertas"
    aria-labelledby="measurement-alerts-heading"
  >
    <div class="list-toolbar">
      <h2 id="measurement-alerts-heading">Alertas</h2>
      <BaseSelect v-model="alertStatus" label="Situação dos alertas" name="statusAlerta"
        ><option value="">Todos</option>
        <option value="PENDENTE">Pendentes</option>
        <option value="RESOLVIDO">Resolvidos</option>
        <option value="IGNORADO">Ignorados</option></BaseSelect
      >
      <span v-if="alerts && !loadingAlerts && !alertsError" class="record-count"
        >{{ alerts.total }} {{ alerts.total === 1 ? 'alerta' : 'alertas' }}</span
      >
    </div>
    <BaseAlert v-if="actionError && !pending" title="Tratamento do alerta" tone="error">{{
      actionError
    }}</BaseAlert>
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
          <div v-if="auth.isAdmin && item.status === 'PENDENTE'" class="inline-actions">
            <BaseButton
              size="small"
              variant="secondary"
              :disabled="resolving"
              @click="prepareResolution(item, 'RESOLVIDO')"
              >Resolver</BaseButton
            ><BaseButton
              size="small"
              variant="secondary"
              :disabled="resolving"
              @click="prepareResolution(item, 'IGNORADO')"
              >Ignorar</BaseButton
            >
          </div>
          <div v-if="item.resolvidoEm" class="measurement-alert-range">
            <p>
              {{ statuses[item.status] }} por {{ item.resolvidoPor?.nome }} em
              {{ formatDateTime(item.resolvidoEm) }}
            </p>
            <p>{{ item.observacaoResolucao }}</p>
          </div>
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
  <ConfirmDialog
    :open="Boolean(pending)"
    :title="pending?.status === 'IGNORADO' ? 'Ignorar alerta' : 'Resolver alerta'"
    :busy="resolving"
    @cancel="pending = null"
    @confirm="resolveAlert"
    ><template v-if="pending"
      ><p>
        {{ pending.item.medicao.parametro.nome }}: {{ formatReading(pending.item.valorMedido) }}
        {{ pending.item.medicao.unidade }}
      </p>
      <p>{{ pending.item.limiteViolado }}</p>
      <BaseAlert v-if="actionError" title="Não foi possível concluir" tone="error">{{
        actionError
      }}</BaseAlert
      ><BaseField
        v-model="observation"
        label="Justificativa"
        required
        :maxlength="2000"
        :disabled="resolving" /></template
  ></ConfirmDialog>
</template>
