import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { medicoesApi } from '@/services/medicoes'
import { viveirosApi } from '@/services/viveiros'
import { ApiError } from '@/services/api'
import type { Medicao, NovaMedicao, Parametro } from '@/types/medicao'
import type { CicloCultivo, DetalhesViveiro } from '@/types/viveiro'
import { decimalValue, localDateTime, measurementTimestamp } from '@/utils/medicoes'
import MedicaoForm from '@/components/medicoes/MedicaoForm.vue'
import MedicaoHistory from '@/components/medicoes/MedicaoHistory.vue'
import MedicoesView from '@/views/MedicoesView.vue'

vi.mock('@/services/medicoes', () => ({
  medicoesApi: {
    parameters: vi.fn<typeof medicoesApi.parameters>(),
    list: vi.fn<typeof medicoesApi.list>(),
    alerts: vi.fn<typeof medicoesApi.alerts>(),
    create: vi.fn<typeof medicoesApi.create>(),
  },
}))
vi.mock('@/services/viveiros', () => ({
  viveirosApi: {
    list: vi.fn<typeof viveirosApi.list>(),
    detail: vi.fn<typeof viveirosApi.detail>(),
  },
}))
const cycle: CicloCultivo = {
  id: 10,
  viveiroId: 1,
  status: 'ATIVO',
  dataInicio: '2026-10-01T00:00:00.000Z',
  qtdLarvasInicial: 100000,
  fornecedorLarvas: null,
  previsaoDespesca: null,
  dataEncerramento: null,
  pesoFinal: null,
  criadoPor: 1,
  criadoEm: '2026-10-01T00:00:00.000Z',
  atualizadoEm: '2026-10-01T00:00:00.000Z',
}
const parameter: Parametro = {
  id: 1,
  codigo: 'OD',
  nome: 'Oxigênio dissolvido',
  unidadePadrao: 'mg/L',
  minPossivel: 0,
  maxPossivel: 30,
  faixaIdeal: { id: 1, minIdeal: 5, maxIdeal: 7, demonstrativa: true, descricao: 'Exemplo' },
}
const pond: DetalhesViveiro = {
  id: 1,
  identificador: 'Viveiro Norte',
  area: 1000,
  profundidadeMedia: 1.5,
  localizacao: null,
  status: 'OCUPADO',
  criadoEm: cycle.criadoEm,
  atualizadoEm: cycle.criadoEm,
  cicloAtivo: cycle,
  totalCiclos: 2,
  ciclos: [cycle, { ...cycle, id: 9, status: 'FINALIZADO' }],
}
const reading: Medicao = {
  id: 1,
  valor: 6.5,
  unidade: 'mg/L',
  medidoEm: '2026-10-28T12:00:00.000Z',
  criadoEm: '2026-10-29T12:00:00.000Z',
  confirmadaForaFaixa: false,
  parametro: { id: 1, codigo: 'OD', nome: 'Oxigênio dissolvido' },
  registradoPor: { id: 5, nome: 'Funcionária Ana' },
  ciclo: { id: 10, status: 'ATIVO', viveiro: { id: 1, identificador: 'Viveiro Norte' } },
  faixaAplicada: { id: 1, minIdeal: 5, maxIdeal: 7, demonstrativa: true },
  alertas: [],
}
const emptyHistory = { medicoes: [], total: 0, limite: 10, offset: 0 }
const emptyAlerts = { alertas: [], total: 0, limite: 10, offset: 0 }
const mounted: VueWrapper[] = []
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-29T15:30:00.000Z'))
  vi.mocked(medicoesApi.parameters).mockResolvedValue({ parametros: [parameter] })
  vi.mocked(medicoesApi.list).mockResolvedValue(emptyHistory)
  vi.mocked(medicoesApi.alerts).mockResolvedValue(emptyAlerts)
  vi.mocked(viveirosApi.list).mockResolvedValue({ viveiros: [pond] })
  vi.mocked(viveirosApi.detail).mockResolvedValue({ viveiro: pond })
})
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  vi.useRealTimers()
})
async function renderForm() {
  const wrapper = mount(MedicaoForm, { props: { ciclo: cycle, viveiro: pond.identificador } })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}
async function fill(wrapper: VueWrapper, value = '6,5') {
  await wrapper.get('select[name="parametroId"]').setValue('1')
  await wrapper.get('input[name="valor"]').setValue(value)
  await wrapper.get('input[name="medidoEm"]').setValue('2026-10-28T09:00')
}
function anomaly(input: NovaMedicao) {
  return new ApiError(409, 'Confirme a anomalia.', {
    codigo: 'CONFIRMACAO_ANOMALIA_NECESSARIA',
    parametro: { id: 1, nome: parameter.nome },
    cicloId: input.cicloId,
    valor: input.valor,
    unidade: input.unidade,
    medidoEm: input.medidoEm,
    faixaIdeal: parameter.faixaIdeal,
    direcao: 'ABAIXO',
  })
}

describe('registro de medições', () => {
  it('exige parâmetro e valor antes de chamar a API', async () => {
    const wrapper = await renderForm()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Selecione o parâmetro.')
    expect(wrapper.text()).toContain('Informe o valor medido.')
    expect(medicoesApi.create).not.toHaveBeenCalled()
  })
  it('envia decimal brasileiro, unidade do catálogo e instante com fuso, sem escolher o responsável', async () => {
    vi.mocked(medicoesApi.create).mockResolvedValue({ medicao: reading })
    const wrapper = await renderForm()
    await fill(wrapper)
    expect(wrapper.text()).toContain('Faixa ideal (exemplo):')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(medicoesApi.create).toHaveBeenCalledWith({
      cicloId: 10,
      parametroId: 1,
      valor: 6.5,
      unidade: 'mg/L',
      medidoEm: measurementTimestamp('2026-10-28T09:00'),
    })
    expect(wrapper.emitted('saved')?.[0]).toEqual([reading])
    expect((wrapper.get('input[name="valor"]').element as HTMLInputElement).value).toBe('')
  })
  it.each(['abc', '-1', '31', '1.000,5', '1e2'])(
    'rejeita valor inválido %s sem salvar',
    async (value) => {
      const wrapper = await renderForm()
      await fill(wrapper, value)
      await wrapper.get('form').trigger('submit')
      expect(wrapper.get('input[name="valor"]').attributes('aria-invalid')).toBe('true')
      expect(medicoesApi.create).not.toHaveBeenCalled()
    },
  )
  it.each(['2026-09-30T09:00', '2027-01-01T09:00', ''])(
    'rejeita horário inválido ou fora do ciclo: %s',
    async (value) => {
      const wrapper = await renderForm()
      await fill(wrapper)
      await wrapper.get('input[name="medidoEm"]').setValue(value)
      await wrapper.get('form').trigger('submit')
      expect(wrapper.get('input[name="medidoEm"]').attributes('aria-invalid')).toBe('true')
      expect(medicoesApi.create).not.toHaveBeenCalled()
    },
  )
  it('aguarda confirmação explícita com o valor e a faixa retornados pela API', async () => {
    vi.mocked(medicoesApi.create)
      .mockImplementationOnce(async (input) => {
        throw anomaly(input)
      })
      .mockResolvedValueOnce({ medicao: { ...reading, valor: 4, confirmadaForaFaixa: true } })
    const wrapper = await renderForm()
    await fill(wrapper, '4')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const dialog = wrapper.get('[role="alertdialog"]')
    expect(dialog.text()).toContain('4 mg/L')
    expect(dialog.text()).toContain('5 a 7 mg/L')
    expect(dialog.text()).toContain('exemplo')
    expect(dialog.text()).toContain('Viveiro Norte · Ciclo #10')
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(medicoesApi.create).toHaveBeenCalledTimes(1)
    await dialog.findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(medicoesApi.create).toHaveBeenLastCalledWith({
      ...vi.mocked(medicoesApi.create).mock.calls[0]![0],
      confirmarAnomalia: true,
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })
  it('permite corrigir sem enviar confirmação nem perder data e parâmetro', async () => {
    vi.mocked(medicoesApi.create)
      .mockImplementationOnce(async (input) => {
        throw anomaly(input)
      })
      .mockResolvedValueOnce({ medicao: reading })
    const wrapper = await renderForm()
    await fill(wrapper, '4')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('[role="alertdialog"] button').trigger('click')
    expect(medicoesApi.create).toHaveBeenCalledTimes(1)
    expect((wrapper.get('input[name="valor"]').element as HTMLInputElement).value).toBe('4')
    await wrapper.get('input[name="valor"]').setValue('6')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(medicoesApi.create).toHaveBeenLastCalledWith(expect.objectContaining({ valor: 6 }))
    expect(vi.mocked(medicoesApi.create).mock.lastCall?.[0].confirmarAnomalia).toBeUndefined()
  })

  it('mostra o valor completo na confirmação, mesmo muito próximo ao limite ideal', async () => {
    vi.mocked(medicoesApi.create).mockImplementation(async (input) => {
      throw anomaly(input)
    })
    const wrapper = await renderForm()
    await fill(wrapper, '7,00001')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alertdialog"]').text()).toContain('7,00001 mg/L')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
  it('não apresenta confirmação quando o erro 409 pertence a outro valor', async () => {
    vi.mocked(medicoesApi.create).mockImplementation(async (input) => {
      throw anomaly({ ...input, valor: 3 })
    })
    const wrapper = await renderForm()
    await fill(wrapper, '4')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Confirme a anomalia.')
  })
  it('mantém os campos quando a API rejeita o registro e impede envios simultâneos', async () => {
    let finish!: (value: { medicao: Medicao }) => void
    vi.mocked(medicoesApi.create).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = await renderForm()
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(medicoesApi.create).toHaveBeenCalledTimes(1)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    finish({ medicao: reading })
    await flushPromises()
    vi.mocked(medicoesApi.create).mockRejectedValueOnce(
      new ApiError(409, 'Somente ciclos ativos podem receber medições.'),
    )
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Somente ciclos ativos podem receber medições.')
    expect((wrapper.get('input[name="valor"]').element as HTMLInputElement).value).toBe('6,5')
  })
})

describe('histórico e seleção de ciclo', () => {
  it('mostra a gravidade dos alertas, a faixa aplicada e o responsável', async () => {
    vi.mocked(medicoesApi.alerts).mockResolvedValue({
      ...emptyAlerts,
      total: 1,
      alertas: [
        {
          id: 1,
          medicao: reading,
          dataHora: reading.criadoEm,
          valorMedido: 4,
          gravidade: 'CRITICA',
          status: 'PENDENTE',
          limiteViolado: 'Abaixo do mínimo ideal de 5 mg/L',
          observacao: null,
        },
      ],
    })
    const wrapper = mount(MedicaoHistory, { props: { cicloId: 10, refresh: 0 } })
    mounted.push(wrapper)
    await flushPromises()
    const section = wrapper.get('[aria-labelledby="measurement-alerts-heading"]')
    expect(section.text()).toContain('Crítica')
    expect(section.text()).toContain('Funcionária Ana')
    expect(section.text()).toContain('5 a 7 mg/L')
    expect(section.text()).toContain('Pendente')
  })
  it('atualiza histórico e alertas depois do registro e limpa a mensagem na próxima tentativa', async () => {
    vi.mocked(medicoesApi.create).mockResolvedValue({ medicao: reading })
    vi.mocked(medicoesApi.list)
      .mockResolvedValueOnce(emptyHistory)
      .mockResolvedValue({ ...emptyHistory, medicoes: [reading], total: 1 })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/medicoes', name: 'medicoes', component: { template: '<div />' } }],
    })
    await router.push('/medicoes?viveiroId=1&cicloId=10')
    const wrapper = mount(MedicoesView, { global: { plugins: [router] } })
    mounted.push(wrapper)
    await flushPromises()
    await fill(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Medição registrada.')
    expect(wrapper.text()).toContain('1 registro')
    expect(wrapper.text()).toContain('Funcionária Ana')
    expect(medicoesApi.alerts).toHaveBeenCalledTimes(2)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).not.toContain('Medição registrada.')
    expect(wrapper.text()).toContain('Informe o valor medido.')
  })
  it('distingue histórico vazio de falha e permite repetir a consulta', async () => {
    vi.mocked(medicoesApi.list).mockRejectedValueOnce(new ApiError(0, 'Sem conexão.'))
    const wrapper = mount(MedicaoHistory, { props: { cicloId: 10, refresh: 0 } })
    mounted.push(wrapper)
    await flushPromises()
    expect(wrapper.text()).toContain('Sem conexão.')
    expect(wrapper.text()).toContain('Nenhum alerta registrado neste ciclo.')
    expect(wrapper.text()).not.toContain('Nenhuma medição registrada')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Nenhuma medição registrada neste ciclo.')
  })
  it('consulta novas medições e alertas ao atualizar e permite paginar sem truncar o histórico', async () => {
    vi.mocked(medicoesApi.list).mockResolvedValue({
      ...emptyHistory,
      total: 12,
      medicoes: [reading],
    })
    const wrapper = mount(MedicaoHistory, { props: { cicloId: 10, refresh: 0 } })
    mounted.push(wrapper)
    await flushPromises()
    expect(wrapper.text()).toContain('Funcionária Ana')
    expect(wrapper.text()).toContain('6,5 mg/L')
    await wrapper
      .get('nav[aria-label="Páginas do histórico"]')
      .findAll('button')[1]!
      .trigger('click')
    await flushPromises()
    expect(medicoesApi.list).toHaveBeenLastCalledWith(10, 10)
    await wrapper.setProps({ refresh: 1 })
    await flushPromises()
    expect(medicoesApi.list).toHaveBeenLastCalledWith(10, 0)
    expect(medicoesApi.alerts).toHaveBeenCalledTimes(2)
  })
  it('preserva o ciclo do link direto, inclusive finalizado, após carregar o viveiro', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/medicoes', name: 'medicoes', component: { template: '<div />' } }],
    })
    await router.push('/medicoes?viveiroId=1&cicloId=9')
    const wrapper = mount(MedicoesView, { global: { plugins: [router] } })
    mounted.push(wrapper)
    await flushPromises()
    expect((wrapper.get('select[name="cicloId"]').element as HTMLSelectElement).value).toBe('9')
    expect(router.currentRoute.value.query.cicloId).toBe('9')
    expect(wrapper.text()).toContain('Este ciclo está finalizado')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(medicoesApi.list).toHaveBeenLastCalledWith(9, 0)
  })
  it('descarta uma consulta atrasada ao trocar o ciclo', async () => {
    let finish!: (value: typeof emptyHistory) => void
    vi.mocked(medicoesApi.list).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = mount(MedicaoHistory, { props: { cicloId: 10, refresh: 0 } })
    mounted.push(wrapper)
    await wrapper.setProps({ cicloId: 9 })
    await flushPromises()
    finish({ ...emptyHistory, total: 99 })
    await flushPromises()
    expect(wrapper.text()).toContain('Nenhuma medição registrada')
    expect(wrapper.text()).not.toContain('99 registros')
  })
})

describe('números e data local', () => {
  it('aceita zero e temperatura negativa e recusa formatos ambíguos', () => {
    expect(decimalValue('0')).toBe(0)
    expect(decimalValue('-2,5')).toBe(-2.5)
    for (const value of ['', '1e3', 'Infinity', '1.000,2']) expect(decimalValue(value)).toBeNull()
    expect(measurementTimestamp('2026-02-30T12:00')).toBeNull()
    expect(measurementTimestamp('2026-10-28T25:00')).toBeNull()
    expect(localDateTime(new Date(measurementTimestamp('2026-10-28T09:00')!))).toBe(
      '2026-10-28T09:00',
    )
  })
})
