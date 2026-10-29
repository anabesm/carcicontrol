import type { StatusCiclo, StatusViveiro } from '@/types/viveiro'

export const pondStates = {
  DISPONIVEL: { label: 'Disponível', tone: 'success' },
  OCUPADO: { label: 'Ocupado', tone: 'primary' },
  MANUTENCAO: { label: 'Em manutenção', tone: 'warning' },
  INATIVO: { label: 'Inativo', tone: 'neutral' },
} as const satisfies Record<StatusViveiro, { label: string; tone: string }>
export const cycleStates = {
  ATIVO: { label: 'Ativo', tone: 'primary' },
  FINALIZADO: { label: 'Finalizado', tone: 'success' },
  CANCELADO: { label: 'Cancelado', tone: 'neutral' },
} as const satisfies Record<StatusCiclo, { label: string; tone: string }>

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 })
const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })
export const formatMeasure = (value: number) => numberFormat.format(value)
export const formatDate = (value: string | null) =>
  value ? dateFormat.format(new Date(value)) : 'Não informada'

export function positiveDecimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function calendarDateValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function today(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
