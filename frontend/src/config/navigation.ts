import type { Component } from 'vue'
import {
  House,
  UsersRound,
  Waves,
  Droplets,
  ClipboardList,
  Wallet,
  ShoppingBag,
  Clock,
  SlidersHorizontal,
  ChartColumn,
  ChartNoAxesCombined,
  MessageSquare,
} from '@lucide/vue'

export interface Section {
  path: string
  name: string
  title: string
  icon: Component
  adminOnly?: boolean
}

export const sections: Section[] = [
  { path: '/viveiros', name: 'Viveiros', title: 'Viveiros e ciclos', icon: Waves },
  { path: '/medicoes', name: 'Medições', title: 'Medições de água', icon: Droplets },
  { path: '/eventos', name: 'Ocorrências', title: 'Ocorrências', icon: ClipboardList },
  { path: '/despesas', name: 'Despesas', title: 'Despesas', icon: Wallet, adminOnly: true },
  { path: '/vendas', name: 'Vendas', title: 'Vendas', icon: ShoppingBag, adminOnly: true },
  {
    path: '/indicadores',
    name: 'Indicadores',
    title: 'Indicadores do cultivo',
    icon: ChartNoAxesCombined,
  },
  {
    path: '/relatorios',
    name: 'Relatórios',
    title: 'Relatórios',
    icon: ChartColumn,
    adminOnly: true,
  },
  {
    path: '/funcionarios',
    adminOnly: true,
    name: 'Funcionários',
    title: 'Funcionários',
    icon: UsersRound,
  },
  { path: '/rotina', name: 'Rotina', title: 'Rotina de medições', icon: Clock },
  {
    path: '/faixas',
    name: 'Parâmetros',
    title: 'Faixas de parâmetros',
    icon: SlidersHorizontal,
    adminOnly: true,
  },
  {
    path: '/whatsapp',
    name: 'WhatsApp',
    title: 'Resumo pelo WhatsApp',
    icon: MessageSquare,
    adminOnly: true,
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
