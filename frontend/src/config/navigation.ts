import type { Component } from 'vue'
import { Droplets, House, UsersRound, Wallet, Waves } from '@lucide/vue'

export interface Section {
  path: string
  name: string
  title: string
  description: string
  icon: Component
  action: string
  preview: string
  adminOnly?: boolean
}

export const sections: Section[] = [
  {
    path: '/viveiros',
    name: 'Viveiros',
    title: 'Viveiros e ciclos',
    icon: Waves,
    description: 'Organize os viveiros e acompanhe cada ciclo de cultivo.',
    action: 'Novo viveiro',
    preview:
      'O cadastro de viveiros, a abertura de ciclos e o histórico do cultivo estarão disponíveis aqui.',
  },
  {
    path: '/medicoes',
    name: 'Medições',
    title: 'Medições de água',
    icon: Droplets,
    description: 'Reúna os registros de qualidade da água e seus alertas.',
    action: 'Nova medição',
    preview:
      'Os registros de qualidade da água e os alertas de parâmetros estarão disponíveis aqui.',
  },
  {
    path: '/financeiro',
    adminOnly: true,
    name: 'Financeiro',
    title: 'Financeiro',
    icon: Wallet,
    description: 'Mantenha despesas e vendas do cultivo organizadas.',
    action: 'Nova despesa',
    preview:
      'Os lançamentos de despesas, vendas e o acompanhamento dos valores estarão disponíveis aqui.',
  },
  {
    path: '/funcionarios',
    adminOnly: true,
    name: 'Funcionários',
    title: 'Funcionários',
    icon: UsersRound,
    description: 'Encontre as pessoas que fazem parte da sua operação.',
    action: 'Novo funcionário',
    preview: 'Cadastre e consulte os acessos da equipe.',
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
