import { computed } from 'vue'
import { sections, navigation } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'

export function useNavigation() {
  const auth = useAuthStore()
  return {
    visibleSections: computed(() => sections.filter((item) => !item.adminOnly || auth.isAdmin)),
    visibleNavigation: computed(() => navigation.filter((item) => !item.adminOnly || auth.isAdmin)),
  }
}
