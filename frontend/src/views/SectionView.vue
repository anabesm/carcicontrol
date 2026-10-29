<script setup lang="ts">
import type { Section } from '@/config/navigation'
import { ArrowLeft, Plus } from '@lucide/vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'

defineProps<{ section: Section }>()
</script>

<template>
  <div class="page-intro">
    <div>
      <p class="eyebrow">ÁREA DE TRABALHO</p>
      <h1>{{ section.title }}</h1>
      <p class="page-description">{{ section.description }}</p>
    </div>
    <BaseButton disabled title="Disponível em uma próxima entrega"
      ><Plus :size="17" />{{ section.action }}</BaseButton
    >
  </div>
  <section class="empty-panel">
    <BaseEmptyState
      title="Esta área está sendo preparada"
      :description="section.preview"
      :icon="section.icon"
    >
      <BaseButton to="/" variant="secondary"><ArrowLeft :size="16" />Voltar ao início</BaseButton>
    </BaseEmptyState>
  </section>
</template>
