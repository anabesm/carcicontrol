<script setup lang="ts">
import { Download } from '@lucide/vue'
import { canInstall, installError, installApp } from '@/pwa'
import BaseButton from '@/components/ui/BaseButton.vue'
</script>
<template>
  <div v-if="canInstall || installError" class="pwa-actions">
    <BaseButton v-if="canInstall" variant="secondary" @click="installApp"
      ><Download :size="18" />Instalar aplicativo</BaseButton
    >
    <p v-if="installError" class="field-error" role="status">{{ installError }}</p>
  </div>
</template>
