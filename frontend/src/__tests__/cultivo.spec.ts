import { describe, expect, it } from 'vitest'
import { cultivationDay, cycleTimeline } from '@/utils/cultivo'

describe('prazo exibido dos ciclos', () => {
  it('usa o dia do cultivo em São Paulo próximo da meia-noite UTC', () => {
    expect(cultivationDay(new Date('2026-11-23T01:00:00Z'))).toBe('2026-11-22')
  })
  it('conta dias pelo calendário e usa a previsão real de despesca', () => {
    expect(
      cycleTimeline(
        { dataInicio: '2026-11-01T00:00:00Z', previsaoDespesca: '2026-12-01T00:00:00Z' },
        new Date('2026-11-16T12:00:00Z'),
      ),
    ).toEqual({ days: 15, plannedDays: 30, overdue: false })
  })
  it('não inventa prazo quando a previsão não foi cadastrada', () => {
    expect(
      cycleTimeline(
        { dataInicio: '2026-11-01', previsaoDespesca: null },
        new Date('2026-11-16T12:00:00Z'),
      ),
    ).toEqual({ days: 15, plannedDays: null, overdue: false })
  })
  it('identifica atraso sem marcar o ciclo como encerrado', () => {
    expect(
      cycleTimeline(
        { dataInicio: '2026-11-01', previsaoDespesca: '2026-11-10' },
        new Date('2026-11-16T12:00:00Z'),
      ),
    ).toEqual({ days: 15, plannedDays: 9, overdue: true })
  })
  it('não transforma uma data final inválida em percentual', () => {
    const timeline = cycleTimeline(
      { dataInicio: '2026-11-10', previsaoDespesca: '2026-11-01' },
      new Date('2026-11-16T12:00:00Z'),
    )
    expect(timeline?.plannedDays).toBeNull()
  })
})
