<script setup lang="ts">
import { computed, ref } from 'vue'
import { CircleHelp, ChevronRight, House, LogOut, Waves } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { useNavigation } from '@/composables/useNavigation'
import { useAuthStore } from '@/stores/auth'
import AppBrand from './AppBrand.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { visibleNavigation: navigation } = useNavigation()
const signingOut = ref(false)
const logoutError = ref('')
const isSectionActive = (path: string) =>
  path === '/' ? route.path === '/' : route.path === path || route.path.startsWith(`${path}/`)
const initials = computed(() =>
  auth.usuario?.nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase(),
)
async function logout() {
  if (signingOut.value) return
  signingOut.value = true
  logoutError.value = ''
  try {
    await auth.signOut()
    await router.replace('/login')
  } catch (error) {
    logoutError.value =
      error instanceof Error ? error.message : 'Não foi possível sair. Tente novamente.'
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <a class="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
  <div v-if="auth.usuario" class="app-shell">
    <aside class="sidebar" aria-label="Menu lateral">
      <div class="sidebar-brand"><AppBrand /></div>
      <div class="nav-heading">ÁREA DE TRABALHO</div>
      <nav class="desktop-nav" aria-label="Navegação principal">
        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'is-active': isSectionActive(item.path) }"
          exact-active-class="is-active"
        >
          <component :is="item.icon" :size="20" :stroke-width="1.8" />
          <span>{{ item.name }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-bottom">
        <RouterLink to="/ajuda" class="nav-item" exact-active-class="is-active">
          <CircleHelp :size="20" :stroke-width="1.8" />
          <span>Ajuda e navegação</span>
        </RouterLink>
        <div class="sidebar-signature">
          <Waves :size="18" :stroke-width="1.7" />
          <span>Mais clareza para o seu cultivo.</span>
        </div>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="mobile-brand"><AppBrand /></div>
        <nav class="breadcrumb" aria-label="Localização">
          <RouterLink to="/"><House :size="16" /><span>Início</span></RouterLink>
          <template v-if="route.path !== '/'">
            <ChevronRight :size="14" />
            <span aria-current="page">{{ route.meta.title }}</span>
          </template>
        </nav>
        <div class="topbar-actions">
          <RouterLink to="/ajuda" class="help-link" aria-label="Abrir ajuda e navegação">
            <CircleHelp :size="19" :stroke-width="1.8" /><span>Ajuda</span>
          </RouterLink>
          <span class="topbar-separator" aria-hidden="true"></span>
          <div class="account-identity">
            <span class="account-avatar" aria-hidden="true">{{ initials }}</span>
            <div class="account-copy">
              <strong>{{ auth.usuario.nome }}</strong
              ><span>{{ auth.isAdmin ? 'Administrador' : 'Funcionário' }}</span>
            </div>
          </div>
          <BaseButton size="small" variant="ghost" :loading="signingOut" @click="logout"
            ><LogOut v-if="!signingOut" :size="16" />Sair</BaseButton
          >
        </div>
      </header>

      <main id="conteudo-principal" class="main-content" tabindex="-1">
        <BaseAlert
          v-if="logoutError"
          title="Não foi possível encerrar a sessão"
          tone="error"
          class="form-notice"
          >{{ logoutError }}</BaseAlert
        >
        <RouterView />
      </main>
      <footer class="workspace-footer">
        <span>CarciControl</span><span>Gestão de carcinicultura</span>
      </footer>
    </div>

    <nav
      class="mobile-nav"
      :style="{ gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))` }"
      aria-label="Navegação principal no celular"
    >
      <RouterLink
        v-for="item in navigation"
        :key="item.path"
        :to="item.path"
        class="mobile-nav-item"
        :class="{ 'is-active': isSectionActive(item.path) }"
        exact-active-class="is-active"
        :aria-label="item.name"
      >
        <span class="mobile-nav-icon"
          ><component :is="item.icon" :size="21" :stroke-width="1.8"
        /></span>
        <span>{{ item.mobileName }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
