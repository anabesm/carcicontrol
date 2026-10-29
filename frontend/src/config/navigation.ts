import type { Component } from 'vue'
import { House, UsersRound, Waves } from '@lucide/vue'

export interface Section {
  path: string
  name: string
  title: string
  icon: Component
  adminOnly?: boolean
}

export const sections: Section[] = [
  {
    path: '/viveiros',
    name: 'Viveiros',
    title: 'Viveiros e ciclos',
    icon: Waves,
  },
  {
    path: '/funcionarios',
    adminOnly: true,
    name: 'Funcionários',
    title: 'Funcionários',
    icon: UsersRound,
  },
]

export const navigation = [
  { path: '/', name: 'Início', mobileName: 'Início', icon: House, adminOnly: false },
  ...sections.map((section) => ({
    path: section.path,
    name: section.name,
    mobileName: section.path === '/funcionarios' ? 'Equipe' : section.name,
    icon: section.icon,
    adminOnly: section.adminOnly ?? false,
  })),
]
