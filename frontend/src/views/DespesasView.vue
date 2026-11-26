<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useResource } from '@/composables/useResource'
import { despesasApi, categories, type Despesa } from '@/services/despesas'
import { currency, dateTime, queryString } from '@/utils/records'
import { formatDate } from '@/utils/viveiros'
import CultivoFilter from '@/components/records/CultivoFilter.vue'
import ExpenseForm from '@/components/records/ExpenseForm.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
const filter = reactive({ viveiroId: '', cicloId: '', inicio: '', fim: '' })
const offset = ref(0)
const showingForm = ref(useRoute().query.novo === '1')
const success = ref('')
const editing = ref<Despesa | null>(null),
  audit = ref<Despesa | null>(null)
const actionError = ref(''),
  fetching = ref(false)
const { data, loading, error, load } = useResource(
  () => despesasApi.list(queryString({ ...filter, offset: offset.value })),
  { despesas: [], total: 0, valorTotal: 0 },
)
async function search() {
  offset.value = 0
  await load()
}
function toggleForm() {
  showingForm.value = !showingForm.value
  editing.value = null
  actionError.value = ''
}
async function openExpense(row: Despesa, historyOnly = false) {
  if (fetching.value) return
  fetching.value = true
  actionError.value = ''
  try {
    const record = (await despesasApi.detail(row.id)).despesa
    if (historyOnly) audit.value = record
    else {
      editing.value = record
      showingForm.value = true
    }
  } catch (cause) {
    actionError.value =
      cause instanceof Error ? cause.message : 'Não foi possível carregar a compra.'
  } finally {
    fetching.value = false
  }
}
async function saved() {
  showingForm.value = false
  success.value = editing.value ? 'Despesa atualizada.' : 'Despesa registrada.'
  editing.value = null
  await search()
}
onMounted(load)
async function changePage(delta: number) {
  offset.value += delta
  await load()
}
</script>
<template>
  <div class="page-intro">
    <h1>Despesas</h1>
    <BaseButton @click="toggleForm">{{
      showingForm ? 'Fechar formulário' : 'Nova despesa'
    }}</BaseButton>
  </div>
  <BaseAlert v-if="success" title="Registro salvo">{{ success }}</BaseAlert>
  <BaseAlert v-if="actionError" title="Consulta da compra" tone="error">{{
    actionError
  }}</BaseAlert>
  <section v-if="showingForm" class="data-panel record-panel">
    <h2>{{ editing ? `Editar despesa #${editing.id}` : 'Nova despesa' }}</h2>
    <ExpenseForm
      :key="editing?.id ?? 'new'"
      :initial="editing ?? undefined"
      @saved="saved"
      @cancel="showingForm = false"
    />
  </section>
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
    <BaseLoading v-if="loading" />
    <BaseAlert v-else-if="error" title="Não foi possível carregar" tone="error"
      >{{ error
      }}<BaseButton variant="secondary" @click="load">Tentar novamente</BaseButton></BaseAlert
    >
    <template v-else
      ><p class="expense-total">
        <strong>{{ currency(data.valorTotal) }}</strong> em {{ data.total }} lançamentos
      </p>
      <p v-if="!data.despesas.length" class="empty-message">Nenhuma despesa encontrada.</p>
      <div v-else class="table-scroll">
        <table class="records-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição / fornecedor</th>
              <th>Vínculo</th>
              <th>Pagamento</th>
              <th>Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.despesas" :key="row.id">
              <td>{{ formatDate(row.data) }}</td>
              <td>
                <details>
                  <summary>{{ row.itens.map((item) => item.descricao).join(', ') }}</summary>
                  <ul class="expense-breakdown">
                    <li v-for="(item, index) in row.itens" :key="index">
                      {{ categories[item.categoria] }} — {{ item.quantidade }} {{ item.unidade }} ×
                      {{ currency(item.valorUnit) }} = {{ currency(item.valorTotalItem) }}
                    </li>
                  </ul>
                  <p>{{ row.observacao }}</p>
                </details>
                <span>{{ row.fornecedorNome || 'Fornecedor não informado' }}</span>
              </td>
              <td>
                {{ row.viveiro?.identificador || 'Geral' }}<br /><span v-if="row.cicloId"
                  >Ciclo #{{ row.cicloId }}</span
                >
              </td>
              <td>{{ row.statusPagamento === 'PAGO' ? 'Pago' : 'Pendente' }}</td>
              <td>
                <strong>{{ currency(row.valorTotal) }}</strong>
              </td>
              <td>
                <div class="inline-actions">
                  <BaseButton
                    variant="secondary"
                    size="small"
                    :disabled="fetching"
                    @click="openExpense(row)"
                    >Editar</BaseButton
                  ><BaseButton
                    variant="secondary"
                    size="small"
                    :disabled="fetching"
                    @click="openExpense(row, true)"
                    >Histórico</BaseButton
                  >
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div></template
    >
    <div v-if="data.total > 50" class="record-pagination">
      <BaseButton variant="secondary" :disabled="offset === 0 || loading" @click="changePage(-50)"
        >Anterior</BaseButton
      ><span>{{ offset + 1 }}–{{ Math.min(offset + 50, data.total) }} de {{ data.total }}</span
      ><BaseButton
        variant="secondary"
        :disabled="offset + 50 >= data.total || loading"
        @click="changePage(50)"
        >Próxima</BaseButton
      >
    </div>
  </section>
  <section v-if="audit" class="data-panel record-panel">
    <div class="list-toolbar">
      <h2>Histórico da despesa #{{ audit.id }}</h2>
      <BaseButton variant="secondary" @click="audit = null">Fechar histórico</BaseButton>
    </div>
    <p>Versão atual: {{ audit.versao }}. Total: {{ currency(audit.valorTotal) }}.</p>
    <p v-if="!audit.historico?.length" class="empty-message">Esta compra ainda não foi alterada.</p>
    <details v-for="change in audit.historico" :key="change.id" class="expense-item">
      <summary>
        Versão {{ change.dadosAnteriores.versao }} — alterada em
        {{ dateTime(change.criadoEm) }} pelo usuário #{{ change.usuarioId }}
      </summary>
      <p>Fornecedor: {{ change.dadosAnteriores.fornecedorNome || 'Não informado' }}</p>
      <p>Total anterior: {{ currency(change.dadosAnteriores.valorTotal) }}</p>
      <ul class="expense-breakdown">
        <li v-for="(item, index) in change.dadosAnteriores.itens" :key="index">
          {{ item.descricao }}: {{ item.quantidade }} {{ item.unidade }} ×
          {{ currency(item.valorUnit) }} = {{ currency(item.valorTotalItem) }}
        </li>
      </ul>
    </details>
  </section>
</template>
