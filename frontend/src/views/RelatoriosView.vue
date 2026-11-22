<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { relatoriosApi, type Relatorio } from '@/services/relatorios'
import { useResource } from '@/composables/useResource'
import { currency, queryString } from '@/utils/records'
import { formatDate } from '@/utils/viveiros'
import { categories } from '@/services/despesas'
import CultivoFilter from '@/components/records/CultivoFilter.vue'
import FinancialChart from '@/components/records/FinancialChart.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
const filter = reactive({ viveiroId: '', cicloId: '', inicio: '', fim: '' })
const offset = ref(0)
const { data, loading, error, load } = useResource(
  () => relatoriosApi.get(queryString({ ...filter, offset: offset.value })),
  null as Relatorio | null,
)
const value = (n: number | null, suffix = '') =>
  n === null
    ? 'Não disponível'
    : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}${suffix}`
async function search() {
  offset.value = 0
  await load()
}
function exportPage() {
  if (!data.value) return
  const rows: unknown[][] = [
    [
      'Viveiro',
      'Ciclo',
      'Situação',
      'Peso final (kg)',
      'Sobrevivência (%)',
      'Produtividade (kg/ha)',
      'Custo registrado/kg (R$)',
      'Despesas (R$)',
      'Receita (R$)',
      'Saldo registrado (R$)',
    ],
  ]
  for (const row of data.value.ciclos)
    rows.push([
      row.viveiro,
      row.id,
      row.status,
      row.pesoFinalKg,
      row.sobrevivenciaPercentual,
      row.produtividadeKgHa,
      row.custoRegistradoPorKg,
      row.despesasRegistradas,
      row.receitaRegistrada,
      row.saldoRegistrado,
    ])
  const escape = (cell: unknown) => {
    let text =
      cell == null ? '' : typeof cell === 'number' ? String(cell).replace('.', ',') : String(cell)
    if (typeof cell === 'string' && /^\s*[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  const blob = new Blob(['\uFEFF' + rows.map((row) => row.map(escape).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = 'carcicontrol-relatorio.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
onMounted(load)
async function changePage(delta: number) {
  offset.value += delta
  await load()
}
</script>
<template>
  <div class="page-intro">
    <h1>Relatórios</h1>
    <BaseButton variant="secondary" :disabled="loading || !data?.ciclos.length" @click="exportPage"
      >Exportar página (CSV)</BaseButton
    >
  </div>
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
        <BaseButton type="submit" variant="secondary" :disabled="loading">Consultar</BaseButton>
      </div>
    </form>
  </section>
  <BaseLoading v-if="loading" /><BaseAlert
    v-else-if="error"
    tone="error"
    title="Não foi possível carregar o relatório"
    >{{ error
    }}<BaseButton variant="secondary" @click="load">Tentar novamente</BaseButton></BaseAlert
  >
  <template v-else-if="data"
    ><section class="data-panel record-panel">
      <h2>Financeiro do período</h2>
      <dl v-if="data.resumo.financeiro" class="metrics-grid">
        <div>
          <dt>Despesas registradas</dt>
          <dd>{{ currency(data.resumo.financeiro.despesas) }}</dd>
        </div>
        <div>
          <dt>Receitas</dt>
          <dd>{{ currency(data.resumo.financeiro.receitas) }}</dd>
        </div>
        <div>
          <dt>Saldo registrado</dt>
          <dd>{{ currency(data.resumo.financeiro.saldoRegistrado) }}</dd>
        </div>
        <div>
          <dt>Peso vendido</dt>
          <dd>{{ value(data.resumo.financeiro.pesoVendidoKg, ' kg') }}</dd>
        </div>
      </dl>
      <FinancialChart :records="data.financeiroPorDia" />
    </section>
    <section class="data-panel record-panel">
      <h2>Despesas por categoria no período</h2>
      <p v-if="!data.custosPorCategoria.length" class="empty-message">
        Nenhuma despesa encontrada.
      </p>
      <table v-else class="records-table">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data.custosPorCategoria" :key="row.categoria">
            <td>{{ categories[row.categoria] }}</td>
            <td>{{ currency(row.valor) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <section class="data-panel record-panel">
      <h2>Indicadores por ciclo</h2>
      <p v-if="!data.ciclos.length" class="empty-message">Nenhum ciclo encontrado.</p>
      <div v-else class="table-scroll">
        <table class="records-table">
          <thead>
            <tr>
              <th>Viveiro / ciclo</th>
              <th>Período</th>
              <th>Produção</th>
              <th>Desempenho</th>
              <th>Custos e resultado registrados</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.ciclos" :key="row.id">
              <td>
                <RouterLink :to="`/viveiros/${row.viveiroId}`" class="text-link"
                  >{{ row.viveiro }} / #{{ row.id }}</RouterLink
                >
                <p>
                  {{
                    row.status === 'ATIVO'
                      ? 'Ativo'
                      : row.status === 'FINALIZADO'
                        ? 'Finalizado'
                        : 'Cancelado'
                  }}
                </p>
              </td>
              <td>
                {{ formatDate(row.dataInicio) }} a
                {{ row.dataEncerramento ? formatDate(row.dataEncerramento) : 'em andamento' }}
                <p v-if="row.diasCultivo !== null">{{ row.diasCultivo }} dias</p>
              </td>
              <td>
                Peso: {{ value(row.pesoFinalKg, ' kg') }}
                <p>Quantidade final: {{ value(row.quantidadeFinal) }}</p>
                <p>Peso médio: {{ value(row.pesoMedioFinalG, ' g') }}</p>
              </td>
              <td>
                Sobrevivência: {{ value(row.sobrevivenciaPercentual, '%') }}
                <p>Produtividade: {{ value(row.produtividadeKgHa, ' kg/ha') }}</p>
                <details v-if="row.dadosFaltantes.length">
                  <summary>Dados indisponíveis</summary>
                  <ul class="expense-breakdown">
                    <li v-for="reason in row.dadosFaltantes" :key="reason">{{ reason }}</li>
                  </ul>
                </details>
              </td>
              <td>
                Despesas: {{ currency(row.despesasRegistradas) }}
                <p>Receita: {{ currency(row.receitaRegistrada) }}</p>
                <p>Saldo: {{ currency(row.saldoRegistrado) }}</p>
                <p>Custo/kg: {{ value(row.custoRegistradoPorKg, ' R$/kg') }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="data.total > data.limite" class="record-pagination">
        <BaseButton
          variant="secondary"
          :disabled="offset === 0 || loading"
          @click="changePage(-data.limite)"
          >Anterior</BaseButton
        ><span
          >{{ offset + 1 }}–{{ Math.min(offset + data.limite, data.total) }} de
          {{ data.total }}</span
        ><BaseButton
          variant="secondary"
          :disabled="offset + data.limite >= data.total || loading"
          @click="changePage(data.limite)"
          >Próxima</BaseButton
        >
      </div>
    </section></template
  >
</template>
