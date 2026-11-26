<script setup lang="ts">
import AppBrand from './AppBrand.vue'
import PwaActions from './PwaActions.vue'
</script>

<template>
  <div class="access-layout">
    <header class="access-brand"><AppBrand /></header>
    <main id="conteudo-principal" class="access-card" tabindex="-1"><slot /></main>
    <PwaActions class="access-install" />
  </div>
</template>
