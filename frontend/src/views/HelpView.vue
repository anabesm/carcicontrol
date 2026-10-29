<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { useNavigation } from '@/composables/useNavigation'
const { visibleNavigation: navigation } = useNavigation()
</script>

<template>
  <div class="page-intro">
    <div>
      <h1>Ajuda e navegação</h1>
    </div>
  </div>
  <div class="help-grid">
    <section class="help-panel">
      <h2>Atalhos</h2>
      <nav aria-label="Atalhos para as seções" class="help-shortcuts">
        <RouterLink v-for="item in navigation" :key="item.path" :to="item.path"
          ><component :is="item.icon" :size="18" /><span>{{ item.name }}</span
          ><ArrowRight :size="15"
        /></RouterLink>
      </nav>
    </section>
  </div>
</template>
