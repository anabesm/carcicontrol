<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import BaseButton from '@/components/ui/BaseButton.vue'
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>Página não encontrada</h1>
    </div>
  </div>
  <BaseButton to="/" variant="secondary"><ArrowLeft :size="16" />Voltar ao início</BaseButton>
</template>
