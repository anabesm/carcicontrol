<script setup lang="ts">
import { computed } from 'vue'
import type { PontoMedicao } from '@/services/indicadores'
import { dateTime } from '@/utils/records'
const props = defineProps<{ points: PontoMedicao[]; unit: string; name: string }>()
const range = computed(() => {
  const values = props.points.map((point) => point.valor)
  const min = Math.min(...values),
    max = Math.max(...values)
  const pad = Math.max((max - min) * 0.15, 0.5)
  return { min: min - pad, max: max + pad }
})
const x = (point: PontoMedicao) => {
  const first = new Date(props.points[0]!.medidoEm).getTime()
  const last = new Date(props.points[props.points.length - 1]!.medidoEm).getTime()
  return last === first
    ? 450
    : 65 + ((new Date(point.medidoEm).getTime() - first) / (last - first)) * 800
}
const y = (value: number) =>
  220 - ((value - range.value.min) / (range.value.max - range.value.min)) * 180
const line = computed(() => props.points.map((point) => `${x(point)},${y(point.valor)}`).join(' '))
</script>
<template>
  <p v-if="!points.length" class="empty-message">Nenhuma medição encontrada para este período.</p>
  <template v-else>
    <svg
      class="measurement-chart"
      viewBox="0 0 900 270"
      role="img"
      :aria-label="`${name}, em ${unit}, ${points.length} medições`"
    >
      <line x1="65" y1="30" x2="65" y2="220" stroke="#cbd5e1" />
      <line x1="65" y1="220" x2="865" y2="220" stroke="#cbd5e1" />
      <template v-for="tick in [0, 1, 2, 3]" :key="tick">
        <text x="55" :y="y(range.min + ((range.max - range.min) * tick) / 3) + 5" text-anchor="end">
          {{
            (range.min + ((range.max - range.min) * tick) / 3).toLocaleString('pt-BR', {
              maximumFractionDigits: 2,
            })
          }}
        </text>
      </template>
      <polyline :points="line" fill="none" stroke="#1351b4" stroke-width="3" />
      <circle
        v-for="point in points"
        :key="point.id"
        :cx="x(point)"
        :cy="y(point.valor)"
        r="4"
        fill="#1351b4"
      >
        <title>{{ dateTime(point.medidoEm) }}: {{ point.valor }} {{ point.unidade }}</title>
      </circle>
      <text x="65" y="250">{{ dateTime(points[0]!.medidoEm) }}</text>
      <text x="865" y="250" text-anchor="end">
        {{ dateTime(points[points.length - 1]!.medidoEm) }}
      </text>
    </svg>
    <details>
      <summary>Ver valores do gráfico</summary>
      <div class="table-scroll">
        <table class="records-table">
          <thead>
            <tr>
              <th>Data e hora</th>
              <th>Valor ({{ unit }})</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in points" :key="point.id">
              <td>{{ dateTime(point.medidoEm) }}</td>
              <td>{{ point.valor.toLocaleString('pt-BR') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </template>
</template>
