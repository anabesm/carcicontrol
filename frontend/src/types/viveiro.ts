export type StatusViveiro = 'DISPONIVEL' | 'OCUPADO' | 'MANUTENCAO' | 'INATIVO'
export type StatusCiclo = 'ATIVO' | 'FINALIZADO' | 'CANCELADO'

export interface CicloCultivo {
  id: number
  viveiroId: number
  status: StatusCiclo
  dataInicio: string
  qtdLarvasInicial: number
  fornecedorLarvas: string | null
  previsaoDespesca: string | null
  dataEncerramento: string | null
  pesoFinal: number | null
  criadoPor: number
  criadoEm: string
  atualizadoEm: string
}

export interface Viveiro {
  id: number
  identificador: string
  area: number
  profundidadeMedia: number
  localizacao: string | null
  status: StatusViveiro
  criadoEm: string
  atualizadoEm: string
  cicloAtivo: CicloCultivo | null
  totalCiclos: number
}

export interface DetalhesViveiro extends Viveiro {
  ciclos: CicloCultivo[]
}
export interface NovoViveiro {
  identificador: string
  area: number
  profundidadeMedia: number
  localizacao: string | null
}
export interface NovoCiclo {
  dataInicio: string
  qtdLarvasInicial: number
  fornecedorLarvas: string | null
  previsaoDespesca: string | null
}
