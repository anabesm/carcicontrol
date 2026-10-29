<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowRight, Plus, Search, Waves } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { viveirosApi } from '@/services/viveiros'
import { ApiError } from '@/services/api'
import type { Viveiro } from '@/types/viveiro'
import { formatDate, formatMeasure, pondStates } from '@/utils/viveiros'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const auth = useAuthStore()
const router = useRouter()
const viveiros = ref<Viveiro[]>([])
const loading = ref(true)
const errorMessage = ref('')
const search = ref('')
const filter = ref('TODOS')
function clearFilters() {
  search.value = ''
  filter.value = 'TODOS'
}
let active = true
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const filtered = computed(() =>
  viveiros.value.filter(
    (pond) =>
      (filter.value === 'TODOS' || pond.status === filter.value) &&
      normalize(`${pond.identificador} ${pond.localizacao ?? ''}`).includes(
        normalize(search.value.trim()),
      ),
  ),
)
const filters = computed(() => [
  { value: 'TODOS', label: 'Todos', count: viveiros.value.length },
  {
    value: 'DISPONIVEL',
    label: 'Disponíveis',
    count: viveiros.value.filter((pond) => pond.status === 'DISPONIVEL').length,
  },
  {
    value: 'OCUPADO',
    label: 'Ocupados',
    count: viveiros.value.filter((pond) => pond.status === 'OCUPADO').length,
  },
])
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await viveirosApi.list()
    if (active) viveiros.value = result.viveiros
  } catch (error) {
    if (!active || (error instanceof ApiError && error.status === 401)) return
    if (error instanceof ApiError && error.status === 403) {
      await router.replace('/acesso-negado')
      return
    }
    errorMessage.value =
      error instanceof Error ? error.message : 'Não foi possível carregar os viveiros.'
  } finally {
    if (active) loading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => {
  active = false
})
</script>

<template>
  <div class="page-intro">
    <div>
      <p class="eyebrow">ÁREAS DE CULTIVO</p>
      <h1>Viveiros e ciclos</h1>
      <p class="page-description">Acompanhe a ocupação e o histórico de cada viveiro.</p>
    </div>
    <BaseButton v-if="auth.isAdmin" to="/viveiros/novo"><Plus :size="18" />Novo viveiro</BaseButton>
  </div>
  <BaseLoading v-if="loading" label="Carregando viveiros…" />
  <div v-else-if="errorMessage" class="data-panel panel-feedback">
    <BaseAlert title="Não foi possível carregar os viveiros" tone="error">{{
      errorMessage
    }}</BaseAlert
    ><BaseButton variant="secondary" @click="load">Tentar novamente</BaseButton>
  </div>
  <section v-else-if="!viveiros.length" class="data-panel">
    <BaseEmptyState
      title="Nenhum viveiro cadastrado"
      :description="
        auth.isAdmin
          ? 'Cadastre o primeiro viveiro para organizar seus ciclos de cultivo.'
          : 'Os viveiros cadastrados pelo administrador aparecerão aqui.'
      "
      :icon="Waves"
      ><BaseButton v-if="auth.isAdmin" to="/viveiros/novo"
        ><Plus :size="17" />Cadastrar viveiro</BaseButton
      ></BaseEmptyState
    >
  </section>
  <template v-else>
    <div class="pond-toolbar">
      <div class="status-filters" role="group" aria-label="Filtrar por situação">
        <button
          v-for="item in filters"
          :key="item.value"
          type="button"
          :aria-pressed="filter === item.value"
          @click="filter = item.value"
        >
          {{ item.label }}<span>{{ item.count }}</span>
        </button>
      </div>
      <BaseField
        v-model="search"
        label="Buscar viveiro"
        type="search"
        hide-label
        placeholder="Buscar por nome ou localização"
        autocomplete="off"
        ><template #leading><Search :size="17" /></template
      ></BaseField>
    </div>
    <div v-if="filtered.length" class="pond-grid">
      <article v-for="pond in filtered" :key="pond.id" class="data-panel pond-card">
        <div class="pond-card-heading">
          <span class="section-icon"><Waves :size="23" :stroke-width="1.7" /></span
          ><StatusBadge v-bind="pondStates[pond.status]" />
        </div>
        <h2>{{ pond.identificador }}</h2>
        <p class="pond-location">{{ pond.localizacao || 'Localização não informada' }}</p>
        <dl class="pond-card-measures">
          <div>
            <dt>Área</dt>
            <dd>{{ formatMeasure(pond.area) }} <span>m²</span></dd>
          </div>
          <div>
            <dt>Profundidade média</dt>
            <dd>{{ formatMeasure(pond.profundidadeMedia) }} <span>m</span></dd>
          </div>
        </dl>
        <p class="pond-cycle-summary">
          {{
            pond.cicloAtivo
              ? `Ciclo ativo desde ${formatDate(pond.cicloAtivo.dataInicio)}`
              : 'Sem ciclo ativo'
          }}
        </p>
        <RouterLink
          :to="{ name: 'detalhes-viveiro', params: { id: pond.id } }"
          class="pond-detail-link"
          :aria-label="`Ver detalhes de ${pond.identificador}`"
          >Ver detalhes<ArrowRight :size="16"
        /></RouterLink>
      </article>
    </div>
    <section v-else class="data-panel">
      <BaseEmptyState
        title="Nenhum viveiro encontrado"
        description="Tente outro nome, localização ou filtro."
        :icon="Search"
        ><BaseButton variant="secondary" @click="clearFilters"
          >Limpar filtros</BaseButton
        ></BaseEmptyState
      >
    </section>
  </template>
</template>
