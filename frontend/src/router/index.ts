import { createRouter, createWebHistory } from 'vue-router'
import type { RouterHistory } from 'vue-router'
import type { Pinia } from 'pinia'
import { nextTick } from 'vue'
import { sections } from '@/config/navigation'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { setUnauthorizedHandler } from '@/services/api'
import { safeRedirect } from '@/utils/access'
import HomeView from '@/views/HomeView.vue'
import SectionView from '@/views/SectionView.vue'
import AppShell from '@/components/layout/AppShell.vue'

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
  appPinia: Pinia = pinia,
) {
  const router = createRouter({
    history,
    routes: [
      {
        path: '/login',
        name: 'login',
        component: () => import('@/views/LoginView.vue'),
        meta: { public: true, title: 'Acesse sua conta' },
      },
      {
        path: '/conexao',
        name: 'conexao',
        component: () => import('@/views/ConnectionView.vue'),
        meta: { public: true, title: 'Verificar conexão' },
      },
      {
        path: '/',
        component: AppShell,
        children: [
          { path: '/', name: 'inicio', component: HomeView, meta: { title: 'Visão geral' } },
          ...sections
            .filter((section) => !['/funcionarios', '/viveiros'].includes(section.path))
            .map((section) => ({
              path: section.path,
              name: section.path.slice(1),
              component: SectionView,
              props: { section },
              meta: { title: section.title, adminOnly: section.adminOnly ?? false },
            })),
          {
            path: '/viveiros',
            name: 'viveiros',
            component: () => import('@/views/ViveirosView.vue'),
            meta: { title: 'Viveiros e ciclos' },
          },
          {
            path: '/viveiros/novo',
            name: 'novo-viveiro',
            component: () => import('@/views/NewViveiroView.vue'),
            meta: { title: 'Novo viveiro', adminOnly: true },
          },
          {
            path: '/viveiros/:id',
            name: 'detalhes-viveiro',
            props: true,
            component: () => import('@/views/ViveiroDetailsView.vue'),
            meta: { title: 'Detalhes do viveiro' },
          },
          {
            path: '/viveiros/:id/ciclos/novo',
            name: 'novo-ciclo',
            props: true,
            component: () => import('@/views/NewCycleView.vue'),
            meta: { title: 'Abrir ciclo', adminOnly: true },
          },
          {
            path: '/funcionarios',
            name: 'funcionarios',
            component: () => import('@/views/EmployeesView.vue'),
            meta: { title: 'Funcionários', adminOnly: true },
          },
          {
            path: '/funcionarios/novo',
            name: 'novo-funcionario',
            component: () => import('@/views/NewEmployeeView.vue'),
            meta: { title: 'Novo funcionário', adminOnly: true },
          },
          {
            path: '/acesso-negado',
            name: 'acesso-negado',
            component: () => import('@/views/ForbiddenView.vue'),
            meta: { title: 'Acesso restrito' },
          },
          {
            path: '/ajuda',
            name: 'ajuda',
            component: () => import('@/views/HelpView.vue'),
            meta: { title: 'Ajuda e navegação' },
          },
          {
            path: '/:pathMatch(.*)*',
            name: 'nao-encontrado',
            component: () => import('@/views/NotFoundView.vue'),
            meta: { title: 'Página não encontrada' },
          },
        ],
      },
    ],
    scrollBehavior: () => ({ top: 0 }),
  })

  router.beforeEach(async (to) => {
    const auth = useAuthStore(appPinia)
    if (to.meta.public && to.name !== 'login') return true
    try {
      const usuario = await auth.restoreSession()
      if (to.name === 'login') return usuario ? safeRedirect(to.query.redirect) : true
      if (!usuario)
        return {
          name: 'login',
          query: {
            redirect: to.fullPath,
            ...(auth.notice === 'expired' ? { motivo: 'sessao-expirada' } : {}),
          },
        }
      if (to.meta.adminOnly && !auth.isAdmin) return { name: 'acesso-negado' }
      return true
    } catch {
      return to.name === 'login' ? true : { name: 'conexao', query: { redirect: to.fullPath } }
    }
  })

  setUnauthorizedHandler(
    () => {
      const auth = useAuthStore(appPinia)
      if (!auth.usuario) return
      const redirect = safeRedirect(router.currentRoute.value.fullPath)
      auth.clearSession('expired')
      void router.replace({ name: 'login', query: { redirect, motivo: 'sessao-expirada' } })
    },
    () => useAuthStore(appPinia).revision,
  )

  router.afterEach(async (to) => {
    document.title = `${String(to.meta.title ?? 'Início')} | CarciControl`
    await nextTick()
    document.getElementById('conteudo-principal')?.focus({ preventScroll: true })
  })

  return router
}

export default createAppRouter()
