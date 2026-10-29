<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ArrowRight, ArrowUpRight, Search } from '@lucide/vue'
import { useNavigation } from '@/composables/useNavigation'
import { useAuthStore } from '@/stores/auth'
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
    normalize(`${section.title} ${section.name}`).includes(normalize(search.value.trim())),
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
      <h1>Visão geral</h1>
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
    </section>

    <aside class="home-rail" aria-label="Conexão">
      <ConnectionStatus />
    </aside>
  </div>
</template>
