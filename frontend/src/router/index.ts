import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import { LogIn } from '@lucide/vue'
import { sections } from '@/config/navigation'
import HomeView from '@/views/HomeView.vue'
import SectionView from '@/views/SectionView.vue'

const loginSection = {
  path: '/login',
  name: 'Entrar',
  title: 'Acesso ao sistema',
  icon: LogIn,
  description: 'Acesse sua conta para acompanhar a rotina do cultivo.',
  action: 'Entrar',
  preview: 'O formulário de login e o acesso aos perfis serão disponibilizados na próxima etapa.',
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'inicio', component: HomeView, meta: { title: 'Visão geral' } },
    ...sections.map((section) => ({
      path: section.path,
      name: section.path.slice(1),
      component: SectionView,
      props: { section },
      meta: { title: section.title },
    })),
    {
      path: '/login',
      name: 'login',
      component: SectionView,
      props: { section: loginSection },
      meta: { title: 'Acesso ao sistema' },
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
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach(async (to) => {
  document.title = `${String(to.meta.title ?? 'Início')} | CarciControl`
  await nextTick()
  document.getElementById('conteudo-principal')?.focus({ preventScroll: true })
})

export default router
