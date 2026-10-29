<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
withDefaults(defineProps<{ label?: string }>(), { label: 'Carregando…' })
</script>

<template>
  <div class="loading-state" role="status" aria-live="polite">
    <LoaderCircle :size="20" class="spin" /><span>{{ label }}</span>
  </div>
</template>
