import type { ConfirmacaoAnomalia, NovaMedicao } from '@/types/medicao'
import { calendarDateValid } from './viveiros'

const readingFormat = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 21 })
export const formatReading = (value: number) => readingFormat.format(value)

export function decimalValue(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

export function localDateTime(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function measurementTimestamp(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !calendarDateValid(value.slice(0, 10)))
    return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || localDateTime(date) !== value) return null
  return date.toISOString()
}

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
export const formatDateTime = (value: string) => dateTimeFormat.format(new Date(value))

export function anomalyDetails(value: unknown, input: NovaMedicao): ConfirmacaoAnomalia | null {
  if (!value || typeof value !== 'object') return null
  const details = value as Partial<ConfirmacaoAnomalia>
  const range = details.faixaIdeal
  if (
    details.codigo !== 'CONFIRMACAO_ANOMALIA_NECESSARIA' ||
    details.cicloId !== input.cicloId ||
    details.parametro?.id !== input.parametroId ||
    typeof details.parametro.nome !== 'string' ||
    details.valor !== input.valor ||
    details.unidade !== input.unidade ||
    details.medidoEm !== input.medidoEm ||
    !['ABAIXO', 'ACIMA'].includes(details.direcao ?? '') ||
    !range ||
    !Number.isInteger(range.id) ||
    !Number.isFinite(range.minIdeal) ||
    !Number.isFinite(range.maxIdeal) ||
    range.minIdeal > range.maxIdeal ||
    typeof range.demonstrativa !== 'boolean'
  )
    return null
  return details as ConfirmacaoAnomalia
}
