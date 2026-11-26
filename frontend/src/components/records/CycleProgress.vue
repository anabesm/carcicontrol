<script setup lang="ts">
import { computed } from 'vue'
import type { CicloCultivo } from '@/types/viveiro'
import { cycleTimeline } from '@/utils/cultivo'
import { formatDate } from '@/utils/viveiros'
import ProgressBar from '@/components/ui/ProgressBar.vue'
const props = defineProps<{ cycle: CicloCultivo }>()
const timeline = computed(() => cycleTimeline(props.cycle))
</script>
<template>
  <div v-if="timeline" class="cycle-progress">
    <div class="progress-heading">
      <span>{{ timeline.plannedDays ? 'Prazo do ciclo' : 'Tempo de cultivo' }}</span
      ><strong>{{ timeline.days }} {{ timeline.days === 1 ? 'dia' : 'dias' }}</strong>
    </div>
    <template v-if="timeline.plannedDays"
      ><ProgressBar
        :value="timeline.days"
        :max="timeline.plannedDays"
        label="Prazo até a despesca prevista"
        :value-text="`${timeline.days} dias decorridos de ${timeline.plannedDays} previstos`"
        :tone="timeline.overdue ? 'warning' : 'default'"
      />
      <p class="progress-note" :class="{ 'progress-note--warning': timeline.overdue }">
        {{
          timeline.overdue
            ? 'Previsão de despesca ultrapassada'
            : `Despesca prevista: ${formatDate(cycle.previsaoDespesca)}`
        }}
      </p></template
    >
  </div>
</template>
