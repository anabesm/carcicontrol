<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ArrowRight, ArrowUpRight, BookOpen, Search } from '@lucide/vue'
import { useNavigation } from '@/composables/useNavigation'
import { useAuthStore } from '@/stores/auth'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import ConnectionStatus from '@/components/system/ConnectionStatus.vue'

const search = ref('')
const auth = useAuthStore()
const { visibleSections: sections } = useNavigation()
const searchField = ref<InstanceType<typeof BaseField>>()
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const filteredSections = computed(() =>
  sections.value.filter((section) =>
    normalize(`${section.title} ${section.description}`).includes(normalize(search.value.trim())),
  ),
)

async function clearSearch() {
  search.value = ''
  await nextTick()
  searchField.value?.focus()
}
</script>

<template>
  <div class="page-intro">
    <div>
      <p class="eyebrow">PAINEL DO CULTIVO</p>
      <h1>Visão geral</h1>
      <p class="page-description">As informações do seu cultivo, organizadas em um só lugar.</p>
    </div>
    <span class="preview-label"
      ><span aria-hidden="true"></span>{{ auth.isAdmin ? 'Administrador' : 'Funcionário' }}</span
    >
  </div>

  <div class="home-grid">
    <section class="areas-section" aria-labelledby="areas-heading">
      <div class="section-heading">
        <div>
          <h2 id="areas-heading">Acesse uma área</h2>
          <p>Escolha por onde começar.</p>
        </div>
        <BaseField
          ref="searchField"
          v-model="search"
          type="search"
          label="Buscar seção"
          hide-label
          placeholder="Buscar seção"
          autocomplete="off"
        >
          <template #leading><Search :size="17" :stroke-width="1.8" /></template>
        </BaseField>
      </div>

      <div v-if="filteredSections.length" class="section-grid">
        <RouterLink
          v-for="section in filteredSections"
          :key="section.path"
          :to="section.path"
          class="section-card"
        >
          <div class="section-card-top">
            <span class="section-icon"
              ><component :is="section.icon" :size="25" :stroke-width="1.6" /></span
            ><ArrowUpRight :size="18" class="section-card-arrow" />
          </div>
          <h3>{{ section.title }}</h3>
          <p>{{ section.description }}</p>
          <span class="section-card-link">Acessar área<ArrowRight :size="15" /></span>
        </RouterLink>
      </div>
      <BaseEmptyState
        v-else
        title="Nenhuma seção encontrada"
        description="Tente outro termo ou limpe a busca para ver todas as áreas."
        :icon="Search"
      >
        <BaseButton variant="secondary" @click="clearSearch">Limpar busca</BaseButton>
      </BaseEmptyState>

      <BaseAlert title="Estamos preparando as próximas etapas" class="overview-notice">
        <template v-if="auth.isAdmin">A gestão de funcionários já está disponível. </template>Os
        registros de cultivo e o acompanhamento dos viveiros serão disponibilizados nas próximas
        entregas.
      </BaseAlert>
    </section>

    <aside class="home-rail" aria-label="Orientações e conexão">
      <section class="guide-card">
        <span class="guide-icon"><BookOpen :size="21" :stroke-width="1.6" /></span>
        <h2>Uma rotina mais organizada</h2>
        <p>Do viveiro aos registros do dia, encontre cada informação na sua área.</p>
        <ol class="guide-steps">
          <li>
            <span>1</span>
            <div>
              <strong>Conheça os viveiros</strong>
              <p>Espaços de cultivo e seus ciclos.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Acompanhe as medições</strong>
              <p>Qualidade da água e alertas.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Organize os registros</strong>
              <p>{{ auth.isAdmin ? 'Despesas, vendas e equipe.' : 'Informações do cultivo.' }}</p>
            </div>
          </li>
        </ol>
        <RouterLink to="/ajuda" class="text-link"
          >Guia de navegação<ArrowRight :size="15"
        /></RouterLink>
      </section>
      <ConnectionStatus />
    </aside>
  </div>
</template>
