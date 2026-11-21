<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { apiRequest } from '@/services/api'
import { useResource } from '@/composables/useResource'
import { currency, dateTime, queryString } from '@/utils/records'
import CultivoFilter from '@/components/records/CultivoFilter.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
interface Venda {
  id: number
  data: string
  cicloId: number
  compradorNome: string
  pesoTotalKg: number
  precoPorKg: number
  valorTotal: number
  biometria: string | null
  observacao: string | null
  viveiro: { identificador: string }
}
const filter = reactive({ viveiroId: '', cicloId: '', inicio: '', fim: '' })
const offset = ref(0)
const { data, loading, error, load } = useResource(
  () =>
    apiRequest<{ vendas: Venda[]; total: number }>(
      `/vendas?${queryString({ ...filter, offset: offset.value })}`,
    ),
  { vendas: [], total: 0 },
)
async function search() {
  offset.value = 0
  await load()
}
onMounted(load)
async function changePage(delta: number) {
  offset.value += delta
  await load()
}
</script>
<template>
  <div class="page-intro"><h1>Vendas</h1></div>
  <section class="data-panel record-panel">
    <form class="form-stack" @submit.prevent="search">
      <CultivoFilter v-model:viveiro-id="filter.viveiroId" v-model:ciclo-id="filter.cicloId" />
      <div class="form-columns">
        <BaseField v-model="filter.inicio" label="De" type="date" /><BaseField
          v-model="filter.fim"
          label="Até"
          type="date"
        />
      </div>
      <div>
        <BaseButton variant="secondary" type="submit" :disabled="loading">Filtrar</BaseButton>
      </div>
    </form>
    <BaseLoading v-if="loading" /><BaseAlert
      v-else-if="error"
      title="Não foi possível carregar"
      tone="error"
      >{{ error
      }}<BaseButton variant="secondary" @click="load">Tentar novamente</BaseButton></BaseAlert
    >
    <p v-else-if="!data.vendas.length" class="empty-message">Nenhuma venda encontrada.</p>
    <div v-else class="table-scroll">
      <table class="records-table">
        <thead>
          <tr>
            <th>Data/hora</th>
            <th>Viveiro / ciclo</th>
            <th>Comprador</th>
            <th>Peso (kg)</th>
            <th>Preço/kg</th>
            <th>Receita</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data.vendas" :key="row.id">
            <td>{{ dateTime(row.data) }}</td>
            <td>{{ row.viveiro.identificador }} / #{{ row.cicloId }}</td>
            <td>
              <details>
                <summary>{{ row.compradorNome }}</summary>
                <p>Biometria: {{ row.biometria || 'Não informada' }}</p>
                <p>{{ row.observacao }}</p>
              </details>
            </td>
            <td>{{ row.pesoTotalKg }}</td>
            <td>{{ currency(row.precoPorKg) }}</td>
            <td>{{ currency(row.valorTotal) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="data.total > 50" class="record-pagination">
      <BaseButton variant="secondary" :disabled="offset === 0 || loading" @click="changePage(-50)"
        >Anterior</BaseButton
      ><BaseButton
        variant="secondary"
        :disabled="offset + 50 >= data.total || loading"
        @click="changePage(50)"
        >Próxima</BaseButton
      >
    </div>
  </section>
</template>
