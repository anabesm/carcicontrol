import type { StatusCiclo } from './viveiro'

export interface FaixaIdeal {
  id: number
  minIdeal: number
  maxIdeal: number
  demonstrativa: boolean
  descricao: string | null
  faseNome?: string | null
  diaInicial?: number
  diaFinal?: number | null
}

export interface Parametro {
  id: number
  codigo: string
  nome: string
  unidadePadrao: string
  minPossivel: number
  maxPossivel: number
  faixaIdeal: FaixaIdeal
}

export interface NovaMedicao {
  cicloId: number
  parametroId: number
  valor: number
  unidade: string
  medidoEm: string
  confirmarAnomalia?: boolean
}

export interface ConfirmacaoAnomalia {
  codigo: 'CONFIRMACAO_ANOMALIA_NECESSARIA'
  parametro: { id: number; nome: string }
  cicloId: number
  valor: number
  unidade: string
  medidoEm: string
  faixaIdeal: FaixaIdeal
  direcao: 'ABAIXO' | 'ACIMA'
}

export interface Alerta {
  id: number
  dataHora: string
  valorMedido: number
  limiteViolado: string
  gravidade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  status: 'PENDENTE' | 'RESOLVIDO' | 'IGNORADO'
  observacao: string | null
  observacaoResolucao?: string | null
  resolvidoEm?: string | null
  resolvidoPor?: { id: number; nome: string } | null
}

export interface Medicao {
  id: number
  valor: number
  unidade: string
  medidoEm: string
  criadoEm: string
  confirmadaForaFaixa: boolean
  parametro: { id: number; codigo: string; nome: string }
  registradoPor: { id: number; nome: string }
  ciclo: { id: number; status: StatusCiclo; viveiro: { id: number; identificador: string } }
  faixaAplicada: (Omit<FaixaIdeal, 'descricao' | 'id'> & { id: number | null }) | null
  alertas: Alerta[]
}

export interface AlertaComMedicao extends Alerta {
  medicao: Omit<Medicao, 'alertas'>
}

export interface PaginaMedicoes {
  medicoes: Medicao[]
  total: number
  limite: number
  offset: number
}
export interface PaginaAlertas {
  alertas: AlertaComMedicao[]
  total: number
  limite: number
  offset: number
}
