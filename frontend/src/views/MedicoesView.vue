<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { viveirosApi } from '@/services/viveiros'
import { ApiError } from '@/services/api'
import type { DetalhesViveiro, Viveiro } from '@/types/viveiro'
import type { Medicao } from '@/types/medicao'
import { cycleStates, formatDate } from '@/utils/viveiros'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import MedicaoForm from '@/components/medicoes/MedicaoForm.vue'
import MedicaoHistory from '@/components/medicoes/MedicaoHistory.vue'

const route = useRoute()
const router = useRouter()
const ponds = ref<Viveiro[]>([])
const pond = ref<DetalhesViveiro | null>(null)
const loading = ref(true)
const loadingPond = ref(false)
const loadError = ref('')
const pondError = ref('')
const pondId = ref('')
const cycleId = ref('')
const busy = ref(false)
const refresh = ref(0)
const success = ref('')
const cycle = computed(() => pond.value?.ciclos.find((item) => item.id === Number(cycleId.value)))
let listVersion = 0
let pondVersion = 0

async function load() {
  const version = ++listVersion
  loading.value = true
  loadError.value = ''
  try {
    const result = await viveirosApi.list()
    if (version !== listVersion) return
    ponds.value = result.viveiros
    const requestedId = typeof route.query.viveiroId === 'string' ? route.query.viveiroId : ''
    pondId.value = result.viveiros.some((item) => String(item.id) === requestedId)
      ? requestedId
      : ''
  } catch (error) {
    if (version === listVersion && !(error instanceof ApiError && error.status === 401))
      loadError.value =
        error instanceof Error ? error.message : 'Não foi possível carregar os viveiros.'
  } finally {
    if (version === listVersion) loading.value = false
  }
}

async function loadPond() {
  const version = ++pondVersion
  const requestedCycle = typeof route.query.cicloId === 'string' ? Number(route.query.cicloId) : 0
  pond.value = null
  cycleId.value = ''
  pondError.value = ''
  success.value = ''
  busy.value = false
  if (!pondId.value) {
    loadingPond.value = false
    return
  }
  loadingPond.value = true
  try {
    const result = await viveirosApi.detail(pondId.value)
    if (version !== pondVersion) return
    pond.value = result.viveiro
    cycleId.value = String(
      result.viveiro.ciclos.find((item) => item.id === requestedCycle)?.id ??
        result.viveiro.cicloAtivo?.id ??
        result.viveiro.ciclos[0]?.id ??
        '',
    )
  } catch (error) {
    if (version === pondVersion && !(error instanceof ApiError && error.status === 401))
      pondError.value =
        error instanceof Error ? error.message : 'Não foi possível carregar os ciclos.'
  } finally {
    if (version === pondVersion) loadingPond.value = false
  }
}

watch(pondId, loadPond)
watch(cycleId, () => {
  success.value = ''
  busy.value = false
})
watch([pondId, cycleId, loadingPond], () => {
  if (loadingPond.value) return
  void router.replace({
    name: 'medicoes',
    query: {
      ...(pondId.value ? { viveiroId: pondId.value } : {}),
      ...(cycleId.value ? { cicloId: cycleId.value } : {}),
    },
  })
})
void load()
onBeforeUnmount(() => {
  listVersion++
  pondVersion++
})
function saved(item: Medicao) {
  success.value = item.confirmadaForaFaixa
    ? 'Medição registrada e alerta gerado.'
    : 'Medição registrada.'
  refresh.value++
}
</script>

<template>
  <div class="page-intro"><h1>Medições de água</h1></div>
  <BaseLoading v-if="loading" label="Carregando viveiros…" />
  <section v-else-if="loadError" class="data-panel panel-feedback">
    <BaseAlert title="Não foi possível carregar os viveiros" tone="error">{{ loadError }}</BaseAlert
    ><BaseButton variant="secondary" @click="load">Tentar novamente</BaseButton>
  </section>
  <section v-else-if="!ponds.length" class="data-panel">
    <p class="empty-measurements">Nenhum viveiro cadastrado.</p>
    <BaseButton to="/viveiros" variant="secondary">Ver viveiros</BaseButton>
  </section>
  <div v-else class="measurements-stack">
    <section class="data-panel measurement-context" aria-label="Viveiro e ciclo da medição">
      <div class="measurement-context-fields">
        <BaseSelect v-model="pondId" label="Viveiro" name="viveiroId" :disabled="busy"
          ><option value="">Selecione o viveiro</option>
          <option v-for="item in ponds" :key="item.id" :value="String(item.id)">
            {{ item.identificador }}
          </option></BaseSelect
        >
        <BaseSelect
          v-model="cycleId"
          label="Ciclo"
          name="cicloId"
          :disabled="busy || loadingPond || !pond?.ciclos.length"
          ><option value="">{{ loadingPond ? 'Carregando…' : 'Selecione o ciclo' }}</option>
          <option v-for="item in pond?.ciclos ?? []" :key="item.id" :value="String(item.id)">
            #{{ item.id }} · {{ cycleStates[item.status].label }} ·
            {{ formatDate(item.dataInicio) }}
          </option></BaseSelect
        >
      </div>
      <p v-if="!pondId" class="measurement-context-hint">
        Selecione um viveiro para registrar ou consultar medições.
      </p>
      <p v-else-if="pond && !pond.ciclos.length" class="measurement-context-hint">
        Nenhum ciclo registrado neste viveiro.
      </p>
    </section>
    <BaseLoading v-if="loadingPond" label="Carregando ciclos…" />
    <section v-else-if="pondError" class="data-panel panel-feedback">
      <BaseAlert title="Não foi possível carregar os ciclos" tone="error">{{ pondError }}</BaseAlert
      ><BaseButton variant="secondary" @click="loadPond">Tentar novamente</BaseButton>
    </section>
    <template v-else-if="pond && cycle">
      <div class="measurement-cycle-heading">
        <h2>
          {{ pond.identificador }} <span>· Ciclo #{{ cycle.id }}</span>
        </h2>
        <StatusBadge v-bind="cycleStates[cycle.status]" />
      </div>
      <BaseAlert v-if="success" :title="success" tone="success" />
      <MedicaoForm
        v-if="cycle.status === 'ATIVO'"
        :key="cycle.id"
        :ciclo="cycle"
        :viveiro="pond.identificador"
        @saved="saved"
        @attempt="success = ''"
        @busy="busy = $event"
      />
      <p v-else class="measurement-context-hint">
        Este ciclo está {{ cycle.status === 'FINALIZADO' ? 'finalizado' : 'cancelado' }} e não
        recebe novas medições.
      </p>
      <MedicaoHistory :key="cycle.id" :ciclo-id="cycle.id" :refresh="refresh" />
    </template>
  </div>
</template>
