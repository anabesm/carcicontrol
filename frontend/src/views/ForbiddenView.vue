<script setup lang="ts">
import { ShieldAlert } from '@lucide/vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
</script>

<template>
  <BaseEmptyState
    title="Acesso restrito"
    description="Esta área está disponível somente para o administrador da equipe."
    :icon="ShieldAlert"
  >
    <BaseButton to="/">Voltar ao início</BaseButton>
  </BaseEmptyState>
</template>
