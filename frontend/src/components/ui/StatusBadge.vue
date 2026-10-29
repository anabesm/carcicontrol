<script setup lang="ts">
withDefaults(
  defineProps<{ label: string; tone?: 'success' | 'primary' | 'warning' | 'neutral' }>(),
  { tone: 'success' },
)
</script>

<template>
  <span class="status-badge" :class="`status-badge--${tone}`"
    ><span aria-hidden="true"></span>{{ label }}</span
  >
</template>
