<script setup lang="ts">
import brandSymbol from '@/assets/brand-symbol.png'
</script>

<template>
  <RouterLink to="/" class="brand" aria-label="CarciControl, início">
    <img :src="brandSymbol" width="38" height="38" alt="" class="brand-symbol" />
    <span class="brand-copy">
      <span class="brand-name">CarciControl</span>
      <span class="brand-caption">Gestão de cultivo</span>
    </span>
  </RouterLink>
</template>
