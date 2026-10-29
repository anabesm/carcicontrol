<script setup lang="ts">
import { ArrowRight, CircleHelp, Search } from '@lucide/vue'
import { useNavigation } from '@/composables/useNavigation'
import { useAuthStore } from '@/stores/auth'
import BaseAlert from '@/components/ui/BaseAlert.vue'
const { visibleNavigation: navigation } = useNavigation()
const auth = useAuthStore()
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
        >Você já pode entrar e sair da sua conta, navegar pelas áreas e conferir a conexão.
        <template v-if="auth.isAdmin"
          >Em Funcionários, consulte e cadastre os acessos da equipe.</template
        >
        Em Viveiros, consulte os dados, o ciclo ativo e o histórico de cada área.
        <template v-if="auth.isAdmin"
          >Use Novo viveiro para cadastrar uma área e Abrir ciclo nos detalhes de um viveiro
          disponível para registrar o povoamento.</template
        >
        Medições e demais registros serão disponibilizados nas próximas etapas.</BaseAlert
      >
    </section>
  </div>
</template>
