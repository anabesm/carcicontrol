import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { viveirosApi } from '@/services/viveiros'
import { ApiError } from '@/services/api'
import type { CicloCultivo, DetalhesViveiro } from '@/types/viveiro'
import type { Usuario } from '@/types/usuario'
import { calendarDateValid, formatDate, positiveDecimal } from '@/utils/viveiros'
import NewViveiroView from '@/views/NewViveiroView.vue'
import NewCycleView from '@/views/NewCycleView.vue'
import ViveiroDetailsView from '@/views/ViveiroDetailsView.vue'
import ViveirosView from '@/views/ViveirosView.vue'

vi.mock('@/services/viveiros', () => ({
  viveirosApi: {
    list: vi.fn<typeof viveirosApi.list>(),
    detail: vi.fn<typeof viveirosApi.detail>(),
    create: vi.fn<typeof viveirosApi.create>(),
    openCycle: vi.fn<typeof viveirosApi.openCycle>(),
  },
}))
const pond: DetalhesViveiro = {
  id: 1,
  identificador: 'Viveiro Norte',
  area: 1500,
  profundidadeMedia: 1.5,
  localizacao: 'Setor norte',
  status: 'DISPONIVEL',
  criadoEm: '2026-10-28T00:00:00.000Z',
  atualizadoEm: '2026-10-28T00:00:00.000Z',
  cicloAtivo: null,
  totalCiclos: 0,
  ciclos: [],
}
const cycle: CicloCultivo = {
  id: 10,
  viveiroId: 1,
  status: 'ATIVO',
  dataInicio: '2026-10-28T00:00:00.000Z',
  qtdLarvasInicial: 120000,
  fornecedorLarvas: null,
  previsaoDespesca: null,
  dataEncerramento: null,
  pesoFinal: null,
  criadoPor: 1,
  criadoEm: '2026-10-28T00:00:00.000Z',
  atualizadoEm: '2026-10-28T00:00:00.000Z',
}
const occupied: DetalhesViveiro = {
  ...pond,
  status: 'OCUPADO',
  cicloAtivo: cycle,
  totalCiclos: 1,
  ciclos: [cycle],
}
const mounted: VueWrapper[] = []

beforeEach(() => vi.resetAllMocks())
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

async function render(
  component: Component,
  props: Record<string, unknown> = {},
  perfil: Usuario['perfil'] = 'ADMINISTRADOR',
) {
  const pinia = createPinia()
  useAuthStore(pinia).usuario = {
    id: 1,
    nome: 'Pessoa de Teste',
    email: 'pessoa@example.test',
    telefone: null,
    perfil,
    status: 'ATIVO',
    criadoEm: '2026-10-28T00:00:00.000Z',
  }
  const blank = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: blank },
      { path: '/viveiros', component: blank },
      { path: '/viveiros/novo', component: blank },
      { path: '/viveiros/:id', name: 'detalhes-viveiro', component: blank },
      { path: '/viveiros/:id/ciclos/novo', name: 'novo-ciclo', component: blank },
    ],
  })
  await router.push('/')
  const wrapper = mount(component, { props, global: { plugins: [pinia, router] } })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

async function fillPond(wrapper: VueWrapper) {
  await wrapper.get('input[name="identificador"]').setValue(' Viveiro Norte ')
  await wrapper.get('input[name="area"]').setValue('1500')
  await wrapper.get('input[name="profundidadeMedia"]').setValue('1,5')
}

describe('cadastro de viveiros', () => {
  it('exige os campos obrigatórios antes de enviar à API', async () => {
    const { wrapper } = await render(NewViveiroView)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Informe o nome ou identificador.')
    expect(wrapper.text()).toContain('Informe a área.')
    expect(wrapper.text()).toContain('Informe a profundidade média.')
    expect(viveirosApi.create).not.toHaveBeenCalled()
  })

  it('envia medidas numéricas e abre o detalhe do registro retornado pelo servidor', async () => {
    vi.mocked(viveirosApi.create).mockResolvedValue({ viveiro: pond })
    const { wrapper, router } = await render(NewViveiroView)
    await fillPond(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(viveirosApi.create).toHaveBeenCalledWith({
      identificador: 'Viveiro Norte',
      area: 1500,
      profundidadeMedia: 1.5,
      localizacao: null,
    })
    expect(router.currentRoute.value.path).toBe('/viveiros/1')
  })

  it('mostra a duplicidade junto ao identificador e preserva os campos preenchidos', async () => {
    vi.mocked(viveirosApi.create).mockRejectedValue(
      new ApiError(409, 'Já existe um viveiro com esse identificador.'),
    )
    const { wrapper } = await render(NewViveiroView)
    await fillPond(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Já existe um viveiro com esse identificador.')
    expect((wrapper.get('input[name="area"]').element as HTMLInputElement).value).toBe('1500')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })
})

describe('consulta e perfis', () => {
  it('permite ao funcionário ver estados e detalhes, sem ação de cadastro', async () => {
    vi.mocked(viveirosApi.list).mockResolvedValue({
      viveiros: [pond, { ...occupied, id: 2, identificador: 'Viveiro Sul' }],
    })
    const { wrapper } = await render(ViveirosView, {}, 'FUNCIONARIO')
    expect(wrapper.text()).toContain('Disponível')
    expect(wrapper.text()).toContain('Ocupado')
    expect(wrapper.find('a[href="/viveiros/novo"]').exists()).toBe(false)
    expect(wrapper.get('a[aria-label="Ver detalhes de Viveiro Norte"]').attributes('href')).toBe(
      '/viveiros/1',
    )
  })

  it('exibe ciclo ativo e histórico para o funcionário sem permitir nova abertura', async () => {
    vi.mocked(viveirosApi.detail).mockResolvedValue({
      viveiro: {
        ...occupied,
        totalCiclos: 2,
        ciclos: [
          cycle,
          { ...cycle, id: 9, status: 'FINALIZADO', dataEncerramento: '2026-09-01T00:00:00.000Z' },
        ],
      },
    })
    const { wrapper } = await render(ViveiroDetailsView, { id: '1' }, 'FUNCIONARIO')
    expect(wrapper.text()).toContain('Ciclo ativo')
    expect(wrapper.text()).toContain('28/10/2026')
    expect(wrapper.text()).toContain('Finalizado')
    expect(wrapper.text()).toContain('01/09/2026')
    expect(wrapper.find('a[href="/viveiros/1/ciclos/novo"]').exists()).toBe(false)
  })

  it('descarta uma resposta de detalhe atrasada ao trocar de viveiro', async () => {
    let finish!: (value: { viveiro: DetalhesViveiro }) => void
    vi.mocked(viveirosApi.detail)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce({ viveiro: { ...pond, id: 2, identificador: 'Viveiro Sul' } })
    const { wrapper } = await render(ViveiroDetailsView, { id: '1' })
    await wrapper.setProps({ id: '2' })
    await flushPromises()
    finish({ viveiro: pond })
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Viveiro Sul')
  })
})

describe('abertura de ciclos', () => {
  it('exige quantidade e recusa previsão anterior ao início', async () => {
    vi.mocked(viveirosApi.detail).mockResolvedValue({ viveiro: pond })
    const { wrapper } = await render(NewCycleView, { id: '1' })
    await wrapper.get('input[name="dataInicio"]').setValue('2026-10-28')
    await wrapper.get('input[name="previsaoDespesca"]').setValue('2026-10-27')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Informe a quantidade inicial de larvas.')
    expect(wrapper.text()).toContain('A previsão não pode ser anterior ao início do ciclo.')
    expect(viveirosApi.openCycle).not.toHaveBeenCalled()
  })

  it('envia apenas o povoamento e confirma a abertura retornada pela API', async () => {
    vi.mocked(viveirosApi.detail).mockResolvedValue({ viveiro: pond })
    vi.mocked(viveirosApi.openCycle).mockResolvedValue({ ciclo: cycle })
    const { wrapper } = await render(NewCycleView, { id: '1' })
    await wrapper.get('input[name="dataInicio"]').setValue('2026-10-28')
    await wrapper.get('input[name="qtdLarvasInicial"]').setValue('120000')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(viveirosApi.openCycle).toHaveBeenCalledWith('1', {
      dataInicio: '2026-10-28',
      qtdLarvasInicial: 120000,
      fornecedorLarvas: null,
      previsaoDespesca: null,
    })
    expect(wrapper.text()).toContain('Ciclo iniciado')
    expect(wrapper.text()).toContain('120.000')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('não apresenta formulário quando o viveiro já tem ciclo ativo', async () => {
    vi.mocked(viveirosApi.detail).mockResolvedValue({ viveiro: occupied })
    const { wrapper } = await render(NewCycleView, { id: '1' })
    expect(wrapper.text()).toContain('Este viveiro já possui um ciclo ativo.')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(viveirosApi.openCycle).not.toHaveBeenCalled()
  })

  it('exibe conflito de uma abertura concorrente e atualiza a disponibilidade', async () => {
    vi.mocked(viveirosApi.detail)
      .mockResolvedValueOnce({ viveiro: pond })
      .mockResolvedValueOnce({ viveiro: occupied })
    vi.mocked(viveirosApi.openCycle).mockRejectedValue(
      new ApiError(409, 'O viveiro já possui um ciclo ativo.'),
    )
    const { wrapper } = await render(NewCycleView, { id: '1' })
    await wrapper.get('input[name="qtdLarvasInicial"]').setValue('120000')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(viveirosApi.detail).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Não foi possível abrir o ciclo')
    expect(wrapper.text()).toContain('O viveiro já possui um ciclo ativo.')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})

describe('medidas e datas', () => {
  it('aceita decimal brasileiro e recusa números ambíguos ou inválidos', () => {
    expect(positiveDecimal('1,5')).toBe(1.5)
    expect(positiveDecimal('1.5')).toBe(1.5)
    for (const value of ['0', '-1', '1.500,00', '1e3', ''])
      expect(positiveDecimal(value)).toBeNull()
  })
  it('preserva o dia do calendário retornado pelo backend', () => {
    expect(formatDate('2026-10-28T00:00:00.000Z')).toBe('28/10/2026')
    expect(calendarDateValid('2026-02-29')).toBe(false)
    expect(calendarDateValid('2024-02-29')).toBe(true)
  })
})
