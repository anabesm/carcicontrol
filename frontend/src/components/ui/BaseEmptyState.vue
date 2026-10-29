<script setup lang="ts">
import type { Component } from 'vue'
import { CircleDashed } from '@lucide/vue'

defineProps<{ title: string; description: string; icon?: Component }>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-state-icon">
      <component :is="icon ?? CircleDashed" :size="30" :stroke-width="1.5" />
    </div>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <div v-if="$slots.default" class="empty-state-actions"><slot /></div>
  </div>
</template>
