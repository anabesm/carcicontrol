<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(
  defineProps<{
    value: number
    max: number
    label: string
    valueText?: string
    tone?: 'default' | 'warning'
  }>(),
  { tone: 'default' },
)
const percent = computed(() =>
  props.max > 0 ? Math.min(100, Math.max(0, (props.value / props.max) * 100)) : 0,
)
</script>
<template>
  <div
    v-if="max > 0"
    class="progress-track"
    :class="`progress-track--${tone}`"
    role="progressbar"
    :aria-label="label"
    :aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuenow="Math.min(max, Math.max(0, value))"
    :aria-valuetext="valueText"
  >
    <span :style="{ width: `${percent}%` }"></span>
  </div>
</template>
