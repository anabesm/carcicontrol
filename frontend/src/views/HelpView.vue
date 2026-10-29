<script setup lang="ts">
import { ArrowRight, CircleHelp, Search } from '@lucide/vue'
import { navigation } from '@/config/navigation'
import BaseAlert from '@/components/ui/BaseAlert.vue'
</script>

<template>
  <div class="page-intro">
    <div>
      <p class="eyebrow">PARA FACILITAR SUA ROTINA</p>
      <h1>Ajuda e navegação</h1>
      <p class="page-description">Conheça as áreas do CarciControl e encontre o que precisa.</p>
    </div>
  </div>
  <div class="help-grid">
    <section class="help-panel">
      <CircleHelp :size="25" :stroke-width="1.5" />
      <h2>Encontre a área certa</h2>
      <p>
        No computador, use o menu à esquerda. No celular, as principais seções ficam na barra
        inferior.
      </p>
      <nav aria-label="Atalhos para as seções" class="help-shortcuts">
        <RouterLink v-for="item in navigation" :key="item.path" :to="item.path"
          ><component :is="item.icon" :size="18" /><span>{{ item.name }}</span
          ><ArrowRight :size="15"
        /></RouterLink>
      </nav>
    </section>
    <section class="help-panel">
      <Search :size="25" :stroke-width="1.5" />
      <h2>Comece pela visão geral</h2>
      <p>Use a busca na página inicial para localizar uma seção pelo nome ou assunto.</p>
      <p>
        Na área “Conexão com o sistema”, você pode conferir a disponibilidade do serviço e tentar
        novamente se necessário.
      </p>
      <BaseAlert title="O que já está disponível"
        >Nesta prévia, você pode testar a navegação, a busca de seções e a verificação de conexão.
        Os formulários de acesso e cadastro serão adicionados nas próximas etapas.</BaseAlert
      >
    </section>
  </div>
</template>
