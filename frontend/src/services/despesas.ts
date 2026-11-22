import { apiRequest } from './api'
export const categories = {
  RACAO: 'Ração',
  ENERGIA: 'Energia',
  INSUMOS_QUIMICOS: 'Insumos químicos',
  BIOLOGICOS: 'Biológicos',
  MANUTENCAO: 'Manutenção',
  MAO_DE_OBRA: 'Mão de obra',
  OUTROS: 'Outros',
} as const
export type Categoria = keyof typeof categories
export interface ExpenseItem {
  categoria: Categoria
  descricao: string
  quantidade: number
  unidade: string
  valorUnit: number
  valorTotalItem: number
  observacao?: string | null
}
export interface AlteracaoDespesa {
  id: number
  usuarioId: number
  criadoEm: string
  dadosAnteriores: {
    versao: number
    valorTotal: number
    statusPagamento: string | null
    fornecedorNome: string | null
    itens: ExpenseItem[]
  }
}
export interface Despesa {
  id: number
  versao: number
  viveiroId: number | null
  cicloId: number | null
  data: string
  fornecedorNome: string | null
  numeroDocumento: string | null
  formaPagamento: string | null
  statusPagamento: string | null
  valorTotal: number
  observacao: string | null
  itens: ExpenseItem[]
  viveiro: { identificador: string } | null
  historico?: AlteracaoDespesa[]
}
export type NewExpense = Omit<
  Despesa,
  'id' | 'versao' | 'valorTotal' | 'viveiro' | 'itens' | 'historico'
> & { itens: Omit<ExpenseItem, 'valorTotalItem'>[] }
export const despesasApi = {
  list: (query: string) =>
    apiRequest<{ despesas: Despesa[]; total: number; valorTotal: number }>(`/despesas?${query}`),
  create: (body: NewExpense) =>
    apiRequest<{ despesa: Despesa }>('/despesas', { method: 'POST', body }),
  detail: (id: number) => apiRequest<{ despesa: Despesa }>(`/despesas/${id}`),
  update: (id: number, body: NewExpense & { versao: number }) =>
    apiRequest<{ despesa: Despesa }>(`/despesas/${id}`, { method: 'PUT', body }),
}
