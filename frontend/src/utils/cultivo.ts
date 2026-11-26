import type { CicloCultivo } from '@/types/viveiro'

export function cultivationDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function cycleTimeline(
  cycle: Pick<CicloCultivo, 'dataInicio' | 'previsaoDespesca'>,
  now = new Date(),
) {
  const start = Date.parse(`${cycle.dataInicio.slice(0, 10)}T00:00:00Z`)
  const current = Date.parse(`${cultivationDay(now)}T00:00:00Z`)
  if (!Number.isFinite(start)) return null
  const days = Math.max(0, Math.floor((current - start) / 86400000))
  const end = cycle.previsaoDespesca
    ? Date.parse(`${cycle.previsaoDespesca.slice(0, 10)}T00:00:00Z`)
    : NaN
  const plannedDays = Math.floor((end - start) / 86400000)
  return {
    days,
    plannedDays: Number.isFinite(plannedDays) && plannedDays > 0 ? plannedDays : null,
    overdue: Number.isFinite(end) && plannedDays > 0 && current > end,
  }
}
