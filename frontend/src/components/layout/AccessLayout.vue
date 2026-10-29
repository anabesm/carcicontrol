<script setup lang="ts">
import AppBrand from './AppBrand.vue'
</script>

<template>
  <div class="access-layout">
    <header class="access-brand"><AppBrand /></header>
    <main id="conteudo-principal" class="access-card" tabindex="-1"><slot /></main>
  </div>
</template>
