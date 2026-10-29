<script setup lang="ts">
import { ArrowLeft, Compass } from '@lucide/vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
</script>

<template>
  <div class="page-intro">
    <div>
      <p class="eyebrow">PÁGINA NÃO ENCONTRADA</p>
      <h1>Vamos encontrar o caminho</h1>
    </div>
  </div>
  <section class="empty-panel">
    <BaseEmptyState
      title="Esta página não foi encontrada"
      description="Confira o endereço ou volte ao início para acessar uma das áreas do sistema."
      :icon="Compass"
    >
      <BaseButton to="/" variant="secondary"><ArrowLeft :size="16" />Voltar ao início</BaseButton>
    </BaseEmptyState>
  </section>
</template>
