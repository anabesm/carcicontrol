export interface Usuario {
  id: number
  nome: string
  email: string
  telefone: string | null
  perfil: 'ADMINISTRADOR' | 'FUNCIONARIO'
  status: 'ATIVO' | 'INATIVO'
  criadoEm: string
}

export interface NovoFuncionario {
  nome: string
  email: string
  telefone: string | null
  senha: string
}
