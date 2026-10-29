<script setup lang="ts">
import AppBrand from './components/layout/AppBrand.vue'
import BaseLoading from './components/ui/BaseLoading.vue'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" v-if="Component" />
    <div v-else class="access-loading">
      <AppBrand /><BaseLoading label="Verificando seu acesso…" />
    </div>
  </RouterView>
</template>
