<script setup lang="ts">
import { CircleAlert, CircleCheck, Info } from '@lucide/vue'

withDefaults(defineProps<{ title: string; tone?: 'info' | 'error' | 'success' }>(), {
  tone: 'info',
})
const icons = { info: Info, error: CircleAlert, success: CircleCheck }
</script>

<template>
  <div class="alert" :class="`alert--${tone}`" :role="tone === 'error' ? 'alert' : 'status'">
    <component :is="icons[tone]" :size="19" :stroke-width="1.8" class="alert-icon" />
    <div>
      <p class="alert-title">{{ title }}</p>
      <div v-if="$slots.default" class="alert-description"><slot /></div>
    </div>
  </div>
</template>
