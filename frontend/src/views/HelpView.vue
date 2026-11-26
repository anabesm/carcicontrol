<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { useNavigation } from '@/composables/useNavigation'
import PwaActions from '@/components/layout/PwaActions.vue'
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
      <h2>Instalar no celular</h2>
      <p>
        No Android, abra o menu do Chrome e escolha <strong>Instalar aplicativo</strong> ou
        <strong>Adicionar à tela inicial</strong>.
      </p>
      <p>
        No iPhone, abra no Safari, toque em <strong>Compartilhar</strong> e em
        <strong>Adicionar à Tela de Início</strong>.
      </p>
      <PwaActions />
    </section>
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
