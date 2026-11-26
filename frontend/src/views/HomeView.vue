<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  ArrowRight,
  Waves,
  Droplets,
  ClipboardList,
  Wallet,
  Clock,
  ChartColumn,
  CircleAlert,
  CheckCheck,
  RefreshCw,
  Plus,
} from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useResource } from '@/composables/useResource'
import { indicadoresApi, type Resumo } from '@/services/indicadores'
import { rotinasApi, type Pendencia } from '@/services/rotinas'
import { viveirosApi } from '@/services/viveiros'
import { apiRequest } from '@/services/api'
import type { Viveiro } from '@/types/viveiro'
import type { PaginaAlertas } from '@/types/medicao'
import { cultivationDay } from '@/utils/cultivo'
import { pondStates } from '@/utils/viveiros'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import CycleProgress from '@/components/records/CycleProgress.vue'

const auth = useAuthStore()
const firstName = computed(() => auth.usuario?.nome.trim().split(/\s+/)[0] || '')
const date = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date())
const summary = useResource(() => indicadoresApi.summary(''), null as Resumo | null)
const ponds = useResource(() => viveirosApi.list(), { viveiros: [] as Viveiro[] })
const routine = useResource(() => rotinasApi.pending(`data=${cultivationDay()}`), {
  pendencias: [] as Pendencia[],
  total: 0,
})
const alerts = useResource(
  () => apiRequest<PaginaAlertas>('/alertas?status=PENDENTE&limite=2'),
  null as PaginaAlertas | null,
)
const completed = computed(
  () => routine.data.value.pendencias.filter((row) => row.situacao === 'CONCLUIDA').length,
)
const dueSoon = computed(() =>
  routine.data.value.pendencias.filter((row) => row.situacao !== 'CONCLUIDA').slice(0, 2),
)
const activePonds = computed(() =>
  ponds.data.value.viveiros.filter((pond) => pond.cicloAtivo).slice(0, 3),
)
const shortcuts = computed(() => [
  { to: '/medicoes', title: 'Registrar medição', icon: Droplets, primary: true },
  { to: '/viveiros', title: 'Consultar viveiros', icon: Waves },
  ...(auth.isAdmin
    ? [
        { to: '/eventos?novo=1', title: 'Registrar ocorrência', icon: ClipboardList },
        { to: '/despesas?novo=1', title: 'Registrar despesa', icon: Wallet },
      ]
    : [{ to: '/eventos', title: 'Consultar ocorrências', icon: ClipboardList }]),
])
async function refresh() {
  await Promise.all([summary.load(), ponds.load(), routine.load(), alerts.load()])
}
onMounted(refresh)
</script>
<template>
  <header class="home-welcome">
    <div>
      <p class="home-date">{{ date }}</p>
      <h1>Olá, {{ firstName }}.</h1>
    </div>
    <BaseButton variant="secondary" :loading="summary.loading.value" @click="refresh"
      ><RefreshCw :size="18" />Atualizar</BaseButton
    >
  </header>
  <section aria-labelledby="quick-actions-heading" class="home-shortcuts-section">
    <h2 id="quick-actions-heading">Acessos rápidos</h2>
    <nav class="home-shortcuts" aria-label="Ações rápidas">
      <RouterLink
        v-for="action in shortcuts"
        :key="action.to"
        :to="action.to"
        class="home-shortcut"
        :class="{ 'home-shortcut--primary': action.primary }"
        ><span class="shortcut-icon"
          ><component :is="action.icon" :size="25" :stroke-width="1.8" /></span
        ><strong>{{ action.title }}</strong
        ><ArrowRight :size="19"
      /></RouterLink>
    </nav>
  </section>
  <div class="home-today-grid">
    <section class="data-panel home-panel" aria-labelledby="today-heading">
      <div class="home-section-heading">
        <h2 id="today-heading"><Clock :size="22" />Rotina de hoje</h2>
        <RouterLink to="/rotina" class="text-link">Ver rotina<ArrowRight :size="17" /></RouterLink>
      </div>
      <BaseLoading v-if="routine.loading.value" label="Carregando rotina…" /><BaseAlert
        v-else-if="routine.error.value"
        tone="error"
        title="Rotina indisponível"
        >{{ routine.error.value }}</BaseAlert
      >
      <template v-else-if="routine.data.value.pendencias.length"
        ><div class="routine-progress-count">
          <strong
            >{{ completed }}<span> / {{ routine.data.value.pendencias.length }}</span></strong
          ><span>medições realizadas</span>
        </div>
        <ProgressBar
          :value="completed"
          :max="routine.data.value.pendencias.length"
          label="Medições realizadas hoje"
          :value-text="`${completed} de ${routine.data.value.pendencias.length} medições realizadas`"
        />
        <div class="home-task-list">
          <RouterLink
            v-for="item in dueSoon"
            :key="`${item.cicloId}-${item.rotinaId}`"
            :to="`/medicoes?viveiroId=${item.viveiroId}&cicloId=${item.cicloId}`"
            class="home-task"
            ><span class="task-time">{{ item.horario }}</span
            ><span
              ><strong>{{ item.parametro.nome }}</strong
              ><span>{{ item.viveiro }}</span></span
            ><span
              class="task-state"
              :class="{ 'task-state--late': item.situacao === 'PENDENTE' }"
              >{{ item.situacao === 'PENDENTE' ? 'Pendente' : 'Aguardando' }}</span
            ><ArrowRight :size="17"
          /></RouterLink>
        </div>
        <p v-if="!dueSoon.length" class="home-empty">
          <CheckCheck :size="22" />Medições do dia concluídas.
        </p></template
      >
      <div v-else class="home-empty">
        <Clock :size="28" />
        <p>Nenhuma medição programada para hoje.</p>
        <RouterLink v-if="auth.isAdmin" to="/rotina" class="text-link"
          >Configurar horários<ArrowRight :size="17"
        /></RouterLink>
      </div>
    </section>
    <section class="data-panel home-panel home-alerts" aria-labelledby="home-alerts-heading">
      <div class="home-section-heading">
        <h2 id="home-alerts-heading"><CircleAlert :size="22" />Atenção ao cultivo</h2>
        <span v-if="alerts.data.value?.total" class="home-count">{{
          alerts.data.value.total
        }}</span>
      </div>
      <BaseLoading v-if="alerts.loading.value" label="Carregando alertas…" /><BaseAlert
        v-else-if="alerts.error.value"
        tone="error"
        title="Alertas indisponíveis"
        >{{ alerts.error.value }}</BaseAlert
      >
      <div v-else-if="!alerts.data.value?.alertas.length" class="home-empty">
        <CheckCheck :size="28" />
        <p>Nenhum alerta pendente.</p>
      </div>
      <div v-else class="home-alert-list">
        <RouterLink
          v-for="alert in alerts.data.value.alertas"
          :key="alert.id"
          :to="`/medicoes?viveiroId=${alert.medicao.ciclo.viveiro.id}&cicloId=${alert.medicao.ciclo.id}#alertas`"
          class="home-alert-row"
          ><span
            ><strong>{{ alert.medicao.ciclo.viveiro.identificador }}</strong
            ><span
              >{{ alert.medicao.parametro.nome }} ·
              <b>{{ alert.valorMedido }} {{ alert.medicao.unidade }}</b></span
            ><small>{{ alert.limiteViolado }}</small></span
          ><ArrowRight :size="18"
        /></RouterLink>
      </div>
    </section>
  </div>
  <section class="home-ponds" aria-labelledby="home-ponds-heading">
    <div class="home-section-heading">
      <h2 id="home-ponds-heading">Seus viveiros</h2>
      <RouterLink to="/viveiros" class="text-link">Ver todos<ArrowRight :size="17" /></RouterLink>
    </div>
    <BaseAlert
      v-if="summary.error.value || ponds.error.value"
      tone="error"
      title="Viveiros indisponíveis"
      >{{ summary.error.value || ponds.error.value }}</BaseAlert
    ><BaseLoading v-else-if="ponds.loading.value" label="Carregando viveiros…" /><template v-else
      ><div v-if="summary.data.value && ponds.data.value.viveiros.length" class="pond-occupancy">
        <span
          ><strong>{{ summary.data.value.ciclosAtivos }}</strong> em cultivo</span
        ><span>{{ summary.data.value.viveiros.DISPONIVEL || 0 }} disponíveis</span
        ><ProgressBar
          :value="summary.data.value.ciclosAtivos"
          :max="ponds.data.value.viveiros.filter((p) => p.status !== 'INATIVO').length"
          label="Ocupação dos viveiros ativos"
        />
      </div>
      <div v-if="activePonds.length" class="home-pond-grid">
        <article v-for="pond in activePonds" :key="pond.id" class="data-panel home-pond-card">
          <div class="home-section-heading">
            <span class="section-icon"><Waves :size="22" /></span
            ><StatusBadge v-bind="pondStates[pond.status]" />
          </div>
          <h3>{{ pond.identificador }}</h3>
          <CycleProgress v-if="pond.cicloAtivo" :cycle="pond.cicloAtivo" /><RouterLink
            :to="`/viveiros/${pond.id}`"
            class="pond-detail-link"
            >Abrir viveiro<ArrowRight :size="18"
          /></RouterLink>
        </article>
      </div>
      <div v-else class="data-panel home-empty">
        <Waves :size="30" />
        <p>
          {{
            ponds.data.value.viveiros.length
              ? 'Nenhum ciclo em andamento.'
              : 'Nenhum viveiro cadastrado.'
          }}
        </p>
        <BaseButton
          v-if="auth.isAdmin"
          :to="ponds.data.value.viveiros.length ? '/viveiros' : '/viveiros/novo'"
          ><Plus :size="18" />{{
            ponds.data.value.viveiros.length ? 'Abrir um ciclo' : 'Novo viveiro'
          }}</BaseButton
        >
      </div></template
    >
  </section>
  <RouterLink to="/indicadores" class="home-indicators-link"
    ><ChartColumn :size="23" /><strong>Indicadores do cultivo</strong><ArrowRight :size="19"
  /></RouterLink>
</template>
