import { apiRequest } from './api'
export interface WhatsAppConfig {
  ativo: boolean
  horario: string
  fuso: string
  nomeModelo: string | null
  idiomaModelo: string
}
export interface ContatoWhatsApp {
  id: number
  nome: string
  telefone: string
  viveiroId: number | null
  ativo: boolean
  autorizadoEm: string
  viveiro: { identificador: string } | null
}
export interface EnvioWhatsApp {
  id: number
  contatoId: number
  contato: { nome: string }
  dia: string
  telefoneDestino: string
  conteudo: string
  status:
    'PENDENTE' | 'PROCESSANDO' | 'ACEITO' | 'ENVIADO' | 'ENTREGUE' | 'LIDO' | 'FALHA' | 'INCERTO'
  tentativas: number
  mensagemProvedorId: string | null
  erro: string | null
  ultimoStatusEm: string | null
  criadoEm: string
}
export interface PreviaWhatsApp {
  dia: string
  fuso: string
  conteudo: string
  medicoes: number
  ocorrencias: number
  limitado: boolean
}
export const whatsappApi = {
  config: () =>
    apiRequest<{
      config: WhatsAppConfig
      integracao: { configurado: boolean; variaveisPendentes: string[] }
    }>('/whatsapp/config'),
  saveConfig: (body: WhatsAppConfig) => apiRequest('/whatsapp/config', { method: 'PUT', body }),
  contacts: () => apiRequest<{ contatos: ContatoWhatsApp[] }>('/whatsapp/contatos'),
  saveContact: (
    body: {
      nome: string
      telefone: string
      viveiroId: number | null
      ativo: boolean
      autorizado: boolean
    },
    id?: number,
  ) => apiRequest(`/whatsapp/contatos${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body }),
  deactivate: (id: number) =>
    apiRequest(`/whatsapp/contatos/${id}`, { method: 'PATCH', body: { ativo: false } }),
  history: (offset = 0) =>
    apiRequest<{ envios: EnvioWhatsApp[]; total: number; limite: number }>(
      `/whatsapp/envios?offset=${offset}`,
    ),
  preview: (query: string) => apiRequest<PreviaWhatsApp>(`/whatsapp/previa?${query}`),
  send: (dia: string) =>
    apiRequest('/whatsapp/enviar', { method: 'POST', body: { dia, confirmar: true } }),
  retry: (id: number) =>
    apiRequest(`/whatsapp/envios/${id}/repetir`, { method: 'POST', body: { confirmar: true } }),
}
