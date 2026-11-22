<script setup lang="ts">
import { computed } from 'vue'
import type { DiaFinanceiro } from '@/services/relatorios'
import { currency } from '@/utils/records'
const props = defineProps<{ records: DiaFinanceiro[] }>()
const monthly = computed(() => props.records.length > 60)
const points = computed(() => {
  if (!monthly.value) return props.records
  const groups = new Map<string, DiaFinanceiro>()
  for (const row of props.records) {
    const key = row.dia.slice(0, 7),
      group = groups.get(key) ?? { dia: key, receitas: 0, despesas: 0 }
    group.receitas += row.receitas
    group.despesas += row.despesas
    groups.set(key, group)
  }
  return [...groups.values()]
})
const max = computed(() =>
  Math.max(1, ...points.value.flatMap((row) => [row.receitas, row.despesas])),
)
const step = computed(() => 770 / Math.max(1, points.value.length))
const compact = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
</script>
<template>
  <p v-if="!records.length" class="empty-message">Nenhum lançamento financeiro neste período.</p>
  <template v-else
    ><p>{{ monthly ? 'Receitas e despesas por mês' : 'Receitas e despesas por dia' }}</p>
    <div class="chart-legend">
      <span><i class="legend-income"></i>Receitas</span
      ><span><i class="legend-cost"></i>Despesas</span>
    </div>
    <svg
      class="measurement-chart"
      viewBox="0 0 900 280"
      role="img"
      aria-label="Comparação de receitas e despesas registradas, em reais"
    >
      <line x1="90" y1="225" x2="870" y2="225" stroke="#cbd5e1" />
      <template v-for="tick in [0, 0.5, 1]" :key="tick">
        <text x="80" :y="230 - tick * 180" text-anchor="end">{{ compact(max * tick) }}</text>
      </template>
      <g v-for="(row, index) in points" :key="row.dia">
        <rect
          :x="95 + index * step"
          :y="225 - (row.receitas / max) * 180"
          :width="step * 0.35"
          :height="(row.receitas / max) * 180"
          fill="#1351b4"
        >
          <title>{{ row.dia }}: receitas {{ currency(row.receitas) }}</title>
        </rect>
        <rect
          :x="95 + index * step + step * 0.38"
          :y="225 - (row.despesas / max) * 180"
          :width="step * 0.35"
          :height="(row.despesas / max) * 180"
          fill="#8b97a8"
        >
          <title>{{ row.dia }}: despesas {{ currency(row.despesas) }}</title>
        </rect>
        <text
          v-if="index % Math.max(1, Math.ceil(points.length / 7)) === 0"
          :x="95 + index * step"
          y="250"
        >
          {{ row.dia.slice(5) || row.dia }}
        </text>
      </g>
    </svg>
    <details>
      <summary>Ver valores do gráfico</summary>
      <div class="table-scroll">
        <table class="records-table">
          <thead>
            <tr>
              <th>{{ monthly ? 'Mês' : 'Dia' }}</th>
              <th>Receitas</th>
              <th>Despesas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in points" :key="row.dia">
              <td>{{ row.dia }}</td>
              <td>{{ currency(row.receitas) }}</td>
              <td>{{ currency(row.despesas) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </template>
</template>
