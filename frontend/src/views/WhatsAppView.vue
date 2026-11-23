<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  whatsappApi,
  type ContatoWhatsApp,
  type EnvioWhatsApp,
  type PreviaWhatsApp,
} from '@/services/whatsapp'
import { dateTime, queryString, today } from '@/utils/records'
import CultivoFilter from '@/components/records/CultivoFilter.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
const config = reactive({
  ativo: false,
  horario: '18:00',
  fuso: 'America/Sao_Paulo',
  nomeModelo: '',
  idiomaModelo: 'pt_BR',
})
const integration = ref({ configurado: false, variaveisPendentes: [] as string[] })
const contacts = ref<ContatoWhatsApp[]>([]),
  deliveries = ref<EnvioWhatsApp[]>([])
const activeContacts = computed(() => contacts.value.filter((row) => row.ativo))
const contactForm = reactive({
  nome: '',
  telefone: '',
  viveiroId: '',
  cicloId: '',
  ativo: true,
  autorizado: false,
})
const editingContact = ref<number>(),
  showingContact = ref(false)
const previewFilter = reactive({ dia: today(), viveiroId: '', cicloId: '' })
const preview = ref<PreviaWhatsApp | null>(null)
const pendingSend = ref<string | null>(null),
  pendingRetry = ref<EnvioWhatsApp | null>(null)
const loading = ref(true),
  busy = ref(false),
  error = ref(''),
  success = ref('')
const offset = ref(0),
  total = ref(0),
  limit = ref(50)
let historyRevision = 0
let timer: ReturnType<typeof setInterval> | undefined
const labels = {
  PENDENTE: 'Na fila',
  PROCESSANDO: 'Processando',
  ACEITO: 'Aceito pelo provedor',
  ENVIADO: 'Enviado',
  ENTREGUE: 'Entregue',
  LIDO: 'Lido',
  FALHA: 'Falha',
  INCERTO: 'Sem confirmação',
}
const missingLabels: Record<string, string> = {
  WHATSAPP_ACCESS_TOKEN: 'Token de acesso',
  WHATSAPP_PHONE_NUMBER_ID: 'Número emissor',
  WHATSAPP_APP_SECRET: 'Segredo do aplicativo',
  WHATSAPP_VERIFY_TOKEN: 'Token de verificação do webhook',
  WHATSAPP_API_VERSION: 'Versão da API',
}
async function loadHistory() {
  const version = ++historyRevision
  try {
    const result = await whatsappApi.history(offset.value)
    if (version !== historyRevision) return
    deliveries.value = result.envios
    total.value = result.total
    limit.value = result.limite
  } catch (cause) {
    if (version === historyRevision)
      error.value = cause instanceof Error ? cause.message : 'Não foi possível consultar os envios.'
  }
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [settings, list] = await Promise.all([whatsappApi.config(), whatsappApi.contacts()])
    Object.assign(config, settings.config, { nomeModelo: settings.config.nomeModelo ?? '' })
    integration.value = settings.integracao
    contacts.value = list.contatos
    await loadHistory()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar.'
  } finally {
    loading.value = false
  }
}
async function run(action: () => Promise<unknown>, message: string) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    await action()
    success.value = message
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível concluir.'
  } finally {
    busy.value = false
  }
}
function editContact(row?: ContatoWhatsApp) {
  editingContact.value = row?.id
  error.value = ''
  success.value = ''
  Object.assign(contactForm, {
    nome: row?.nome ?? '',
    telefone: row?.telefone ?? '',
    viveiroId: row?.viveiroId ? String(row.viveiroId) : '',
    cicloId: '',
    ativo: row?.ativo ?? true,
    autorizado: Boolean(row),
  })
  showingContact.value = true
}
async function saveContact() {
  await run(async () => {
    await whatsappApi.saveContact(
      {
        nome: contactForm.nome,
        telefone: contactForm.telefone,
        viveiroId: contactForm.viveiroId ? Number(contactForm.viveiroId) : null,
        ativo: contactForm.ativo,
        autorizado: contactForm.autorizado,
      },
      editingContact.value,
    )
    showingContact.value = false
  }, 'Contato salvo.')
}
const saveConfiguration = () =>
  run(
    () => whatsappApi.saveConfig({ ...config, nomeModelo: config.nomeModelo || null }),
    'Agendamento salvo.',
  )
const deactivateContact = (row: ContatoWhatsApp) =>
  run(() => whatsappApi.deactivate(row.id), 'Contato desativado.')
async function loadPreview() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  preview.value = null
  try {
    preview.value = await whatsappApi.preview(
      queryString({ dia: previewFilter.dia, viveiroId: previewFilter.viveiroId }),
    )
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível gerar a prévia.'
  } finally {
    busy.value = false
  }
}
async function confirmSend() {
  const day = pendingSend.value,
    retry = pendingRetry.value
  await run(
    () => (retry ? whatsappApi.retry(retry.id) : whatsappApi.send(day!)),
    'Solicitação processada. Consulte a situação das mensagens.',
  )
  pendingSend.value = null
  pendingRetry.value = null
}
onMounted(async () => {
  await load()
  timer = setInterval(() => {
    if (!document.hidden && !busy.value) void loadHistory()
  }, 15000)
})
onBeforeUnmount(() => {
  historyRevision++
  if (timer) clearInterval(timer)
})
async function changePage(delta: number) {
  offset.value += delta
  await loadHistory()
}
function clearPending() {
  pendingSend.value = null
  pendingRetry.value = null
}
</script>
<template>
  <div class="page-intro">
    <h1>Resumo pelo WhatsApp</h1>
    <BaseButton variant="secondary" :disabled="busy || loading" @click="load">Atualizar</BaseButton>
  </div>
  <BaseAlert v-if="error" tone="error" title="Não foi possível concluir">{{ error }}</BaseAlert
  ><BaseAlert v-if="success" title="Solicitação concluída">{{ success }}</BaseAlert
  ><BaseLoading v-if="loading" />
  <template v-else>
    <BaseAlert v-if="!integration.configurado" title="Integração ainda não configurada"
      >A prévia está disponível. Para enviar mensagens, configure a conta da Meta no servidor.
      <details>
        <summary>Configuração pendente</summary>
        <ul class="expense-breakdown">
          <li v-for="name in integration.variaveisPendentes" :key="name">
            {{ missingLabels[name] || name }}
          </li>
        </ul>
      </details></BaseAlert
    >
    <section class="data-panel record-panel">
      <h2>Agendamento</h2>
      <form class="form-stack" @submit.prevent="saveConfiguration">
        <label class="checkbox-label"
          ><input v-model="config.ativo" type="checkbox" :disabled="busy" /> Enviar resumo
          diariamente</label
        >
        <div class="form-columns">
          <BaseField
            v-model="config.horario"
            label="Horário"
            type="time"
            required
            :disabled="busy"
          /><BaseField v-model="config.fuso" label="Fuso horário" required :disabled="busy" />
        </div>
        <div class="form-columns">
          <BaseField
            v-model="config.nomeModelo"
            label="Nome do modelo aprovado"
            :maxlength="512"
            :disabled="busy"
          /><BaseField
            v-model="config.idiomaModelo"
            label="Idioma do modelo"
            required
            :disabled="busy"
          />
        </div>
        <div><BaseButton type="submit" :disabled="busy">Salvar agendamento</BaseButton></div>
      </form>
    </section>
    <section class="data-panel record-panel">
      <div class="list-toolbar">
        <h2>Destinatários</h2>
        <BaseButton variant="secondary" :disabled="busy" @click="editContact()"
          >Novo contato</BaseButton
        >
      </div>
      <form v-if="showingContact" class="form-stack" @submit.prevent="saveContact">
        <div class="form-columns">
          <BaseField
            v-model="contactForm.nome"
            label="Nome do contato"
            required
            :maxlength="120"
            :disabled="busy"
          /><BaseField
            v-model="contactForm.telefone"
            label="País + DDD + número"
            type="tel"
            placeholder="5585999999999"
            required
            :maxlength="16"
            :disabled="busy"
          />
        </div>
        <CultivoFilter
          v-model:viveiro-id="contactForm.viveiroId"
          v-model:ciclo-id="contactForm.cicloId"
          form
          hide-cycle
          global-label="Todos os viveiros"
          :disabled="busy"
        /><label class="checkbox-label"
          ><input v-model="contactForm.ativo" type="checkbox" :disabled="busy" /> Contato
          ativo</label
        ><label class="checkbox-label"
          ><input v-model="contactForm.autorizado" type="checkbox" required :disabled="busy" />
          Confirmo que o destinatário autorizou o recebimento dos resumos</label
        >
        <div class="form-actions">
          <BaseButton type="submit" :disabled="busy">Salvar contato</BaseButton
          ><BaseButton variant="secondary" :disabled="busy" @click="showingContact = false"
            >Cancelar</BaseButton
          >
        </div>
      </form>
      <p v-if="!contacts.length" class="empty-message">Nenhum destinatário cadastrado.</p>
      <div v-else class="table-scroll">
        <table class="records-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Número</th>
              <th>Viveiro</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in contacts" :key="row.id">
              <td>{{ row.nome }}</td>
              <td>+{{ row.telefone }}</td>
              <td>{{ row.viveiro?.identificador || 'Todos' }}</td>
              <td>{{ row.ativo ? 'Ativo' : 'Inativo' }}</td>
              <td>
                <div class="inline-actions">
                  <BaseButton
                    variant="secondary"
                    size="small"
                    :disabled="busy"
                    @click="editContact(row)"
                    >Editar</BaseButton
                  ><BaseButton
                    v-if="row.ativo"
                    variant="secondary"
                    size="small"
                    :disabled="busy"
                    @click="deactivateContact(row)"
                    >Desativar</BaseButton
                  >
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="data-panel record-panel">
      <h2>Prévia do resumo</h2>
      <form class="form-stack" @submit.prevent="loadPreview">
        <BaseField
          v-model="previewFilter.dia"
          label="Dia do resumo"
          type="date"
          required
          :disabled="busy"
        /><CultivoFilter
          v-model:viveiro-id="previewFilter.viveiroId"
          v-model:ciclo-id="previewFilter.cicloId"
          hide-cycle
          global-label="Todos os viveiros"
          :disabled="busy"
        />
        <div class="form-actions">
          <BaseButton type="submit" variant="secondary" :disabled="busy">Gerar prévia</BaseButton
          ><BaseButton
            :disabled="
              busy || !integration.configurado || !config.nomeModelo || !activeContacts.length
            "
            @click="pendingSend = previewFilter.dia"
            >Enviar para contatos ativos</BaseButton
          >
        </div>
      </form>
      <div v-if="preview" class="summary-preview">
        <p>
          {{ preview.medicoes }} medições e {{ preview.ocorrencias }} ocorrências. Fuso:
          {{ preview.fuso }}.
        </p>
        <p class="preserve-text">{{ preview.conteudo }}</p>
      </div>
    </section>
    <section class="data-panel record-panel">
      <h2>Histórico de envios</h2>
      <p v-if="!deliveries.length" class="empty-message">Nenhum envio registrado.</p>
      <div v-else class="table-scroll">
        <table class="records-table">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Destinatário</th>
              <th>Situação</th>
              <th>Último status</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in deliveries" :key="row.id">
              <td>{{ row.dia }}</td>
              <td>{{ row.contato.nome }}<br />+{{ row.telefoneDestino }}</td>
              <td>{{ labels[row.status] }}</td>
              <td>{{ row.ultimoStatusEm ? dateTime(row.ultimoStatusEm) : 'Aguardando' }}</td>
              <td>
                <details>
                  <summary>Ver resumo e resultado</summary>
                  <p class="preserve-text">{{ row.conteudo }}</p>
                  <p>Tentativas: {{ row.tentativas }}</p>
                  <p v-if="row.erro">{{ row.erro }}</p>
                  <p v-if="row.mensagemProvedorId">Protocolo: {{ row.mensagemProvedorId }}</p>
                </details>
                <BaseButton
                  v-if="row.status === 'FALHA' && !row.mensagemProvedorId"
                  size="small"
                  variant="secondary"
                  :disabled="busy || !integration.configurado"
                  @click="pendingRetry = row"
                  >Tentar novamente</BaseButton
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="total > limit" class="record-pagination">
        <BaseButton variant="secondary" :disabled="offset === 0 || busy" @click="changePage(-limit)"
          >Anterior</BaseButton
        ><span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} de {{ total }}</span
        ><BaseButton
          variant="secondary"
          :disabled="offset + limit >= total || busy"
          @click="changePage(limit)"
          >Próxima</BaseButton
        >
      </div>
    </section>
  </template>
  <ConfirmDialog
    :open="Boolean(pendingSend || pendingRetry)"
    :title="pendingRetry ? 'Repetir envio com falha' : 'Enviar resumo pelo WhatsApp'"
    :busy="busy"
    confirm-label="Confirmar envio"
    @cancel="clearPending"
    @confirm="confirmSend"
    ><template v-if="pendingRetry"
      ><p>
        {{ pendingRetry.contato.nome }} — +{{ pendingRetry.telefoneDestino }}. Resumo de
        {{ pendingRetry.dia }}.
      </p></template
    ><template v-else
      ><p>
        Resumo de {{ pendingSend }} para {{ activeContacts.length }} destinatários ativos, conforme
        o viveiro configurado em cada contato.
      </p>
      <ul class="expense-breakdown">
        <li v-for="row in activeContacts" :key="row.id">{{ row.nome }} — +{{ row.telefone }}</li>
      </ul></template
    ></ConfirmDialog
  >
</template>
