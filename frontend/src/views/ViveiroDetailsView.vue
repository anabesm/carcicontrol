<script setup lang="ts">
import { ArrowLeft, Plus, Waves } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useViveiro } from '@/composables/useViveiro'
import { cycleStates, formatDate, formatMeasure, pondStates } from '@/utils/viveiros'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const { viveiro, loading, errorMessage, notFound, load } = useViveiro(() => props.id)
</script>

<template>
  <RouterLink to="/viveiros" class="text-link back-link"
    ><ArrowLeft :size="16" />Viveiros e ciclos</RouterLink
  >
  <BaseLoading v-if="loading" label="Carregando detalhes do viveiro…" />
  <template v-else-if="notFound"
    ><div class="page-intro">
      <div>
        <h1>Viveiro não encontrado</h1>
      </div>
    </div>
    <BaseButton to="/viveiros" variant="secondary">Ver viveiros</BaseButton></template
  >
  <section v-else-if="errorMessage" class="data-panel panel-feedback">
    <h1 class="resource-error-heading">Detalhes do viveiro</h1>
    <BaseAlert title="Não foi possível carregar o viveiro" tone="error">{{
      errorMessage
    }}</BaseAlert
    ><BaseButton variant="secondary" @click="load">Tentar novamente</BaseButton>
  </section>
  <template v-else-if="viveiro">
    <div class="page-intro">
      <div>
        <h1 class="record-title">{{ viveiro.identificador }}</h1>
      </div>
      <StatusBadge v-bind="pondStates[viveiro.status]" />
    </div>
    <div class="pond-details-grid">
      <section class="data-panel pond-info-panel" aria-labelledby="pond-info-heading">
        <div class="pond-panel-heading"><h2 id="pond-info-heading">Informações do viveiro</h2></div>
        <dl class="record-details">
          <div>
            <dt>Área</dt>
            <dd>{{ formatMeasure(viveiro.area) }} m²</dd>
          </div>
          <div>
            <dt>Profundidade média</dt>
            <dd>{{ formatMeasure(viveiro.profundidadeMedia) }} m</dd>
          </div>
          <div class="record-details-wide">
            <dt>Localização</dt>
            <dd>{{ viveiro.localizacao || 'Não informada' }}</dd>
          </div>
        </dl>
      </section>
      <section class="data-panel active-cycle-panel" aria-labelledby="active-cycle-heading">
        <div class="pond-panel-heading">
          <h2 id="active-cycle-heading">
            Ciclo ativo<span v-if="viveiro.cicloAtivo" class="cycle-reference"
              >#{{ viveiro.cicloAtivo.id }}</span
            >
          </h2>
          <StatusBadge v-if="viveiro.cicloAtivo" v-bind="cycleStates[viveiro.cicloAtivo.status]" />
        </div>
        <template v-if="viveiro.cicloAtivo">
          <dl class="record-details">
            <div>
              <dt>Início do povoamento</dt>
              <dd>{{ formatDate(viveiro.cicloAtivo.dataInicio) }}</dd>
            </div>
            <div>
              <dt>Larvas iniciais</dt>
              <dd>{{ formatMeasure(viveiro.cicloAtivo.qtdLarvasInicial) }}</dd>
            </div>
            <div>
              <dt>Fornecedor de larvas</dt>
              <dd>{{ viveiro.cicloAtivo.fornecedorLarvas || 'Não informado' }}</dd>
            </div>
            <div>
              <dt>Previsão de despesca</dt>
              <dd>{{ formatDate(viveiro.cicloAtivo.previsaoDespesca) }}</dd>
            </div>
          </dl>
        </template>
        <div v-else class="no-active-cycle">
          <h3>Nenhum ciclo ativo</h3>
          <BaseButton
            v-if="auth.isAdmin && viveiro.status === 'DISPONIVEL'"
            :to="{ name: 'novo-ciclo', params: { id: viveiro.id } }"
            ><Plus :size="17" />Abrir ciclo</BaseButton
          >
        </div>
      </section>
    </div>
    <section class="data-panel pond-history-panel" aria-labelledby="history-heading">
      <div class="list-toolbar">
        <div>
          <h2 id="history-heading">Histórico de ciclos</h2>
          <p>
            {{ viveiro.totalCiclos }}
            {{ viveiro.totalCiclos === 1 ? 'ciclo registrado' : 'ciclos registrados' }}
          </p>
        </div>
      </div>
      <BaseEmptyState
        v-if="!viveiro.ciclos.length"
        title="O histórico começa no primeiro ciclo"
        description="Os ciclos de cultivo deste viveiro aparecerão aqui após o povoamento."
        :icon="Waves"
      />
      <table v-else class="pond-history-table">
        <caption class="sr-only">
          Histórico de ciclos de
          {{
            viveiro.identificador
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Ciclo</th>
            <th scope="col">Situação</th>
            <th scope="col">Início</th>
            <th scope="col">Encerramento</th>
            <th scope="col">Larvas iniciais</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cycle in viveiro.ciclos" :key="cycle.id">
            <td class="cycle-table-id">Ciclo #{{ cycle.id }}</td>
            <td data-label="Situação"><StatusBadge v-bind="cycleStates[cycle.status]" /></td>
            <td data-label="Início">{{ formatDate(cycle.dataInicio) }}</td>
            <td data-label="Encerramento">
              {{
                cycle.dataEncerramento
                  ? formatDate(cycle.dataEncerramento)
                  : cycle.status === 'ATIVO'
                    ? 'Em andamento'
                    : 'Não informado'
              }}
            </td>
            <td data-label="Larvas iniciais">{{ formatMeasure(cycle.qtdLarvasInicial) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </template>
</template>
