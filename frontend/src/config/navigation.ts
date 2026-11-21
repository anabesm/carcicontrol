import type { Component } from 'vue'
import { House, UsersRound, Waves, Droplets, ClipboardList, Wallet, ShoppingBag } from '@lucide/vue'

export interface Section {
  path: string
  name: string
  title: string
  icon: Component
  adminOnly?: boolean
}

export const sections: Section[] = [
  { path: '/eventos', name: 'Ocorrências', title: 'Ocorrências', icon: ClipboardList },
  { path: '/despesas', name: 'Despesas', title: 'Despesas', icon: Wallet, adminOnly: true },
  { path: '/vendas', name: 'Vendas', title: 'Vendas', icon: ShoppingBag, adminOnly: true },
  {
    path: '/viveiros',
    name: 'Viveiros',
    title: 'Viveiros e ciclos',
    icon: Waves,
  },
  {
    path: '/medicoes',
    name: 'Medições',
    title: 'Medições de água',
    icon: Droplets,
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
