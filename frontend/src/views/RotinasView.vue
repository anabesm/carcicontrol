<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { apiRequest } from '@/services/api'
import { rotinasApi, type Rotina } from '@/services/rotinas'
import type { ParametroConfiguravel } from '@/services/faixas'
import { useAuthStore } from '@/stores/auth'
import { useResource } from '@/composables/useResource'
import { dateTime, queryString, today } from '@/utils/records'
import CultivoFilter from '@/components/records/CultivoFilter.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
const auth = useAuthStore()
const filter = reactive({ viveiroId: '', cicloId: '', data: today() })
const form = reactive({
  viveiroId: '',
  cicloId: '',
  parametroId: '',
  horario: '06:00',
  fuso: 'America/Sao_Paulo',
  toleranciaMinutos: '60',
})
const parameters = ref<ParametroConfiguravel[]>([])
const routines = ref<Rotina[]>([])
const editId = ref<number>()
const showingForm = ref(false),
  saving = ref(false),
  error = ref(''),
  success = ref('')
const {
  data,
  loading,
  error: pendingError,
  load,
} = useResource(() => rotinasApi.pending(queryString(filter)), { pendencias: [], total: 0 })
async function loadConfig() {
  try {
    const [catalog, list] = await Promise.all([
      apiRequest<{ parametros: ParametroConfiguravel[] }>('/parametros/catalogo'),
      rotinasApi.list(),
    ])
    parameters.value = catalog.parametros
    routines.value = list.rotinas
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar os horários.'
  }
}
function edit(row?: Rotina) {
  editId.value = row?.id
  Object.assign(form, {
    viveiroId: row?.viveiroId ? String(row.viveiroId) : '',
    cicloId: '',
    parametroId: row ? String(row.parametroId) : '',
    horario: row?.horario ?? '06:00',
    fuso: row?.fuso ?? 'America/Sao_Paulo',
    toleranciaMinutos: String(row?.toleranciaMinutos ?? 60),
  })
  error.value = ''
  success.value = ''
  showingForm.value = true
}
async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await rotinasApi.save(
      {
        parametroId: Number(form.parametroId),
        viveiroId: form.viveiroId ? Number(form.viveiroId) : null,
        horario: form.horario,
        fuso: form.fuso,
        toleranciaMinutos: Number(form.toleranciaMinutos),
      },
      editId.value,
    )
    showingForm.value = false
    success.value = 'Horário salvo.'
    await loadConfig()
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível salvar.'
  } finally {
    saving.value = false
  }
}
async function deactivate(row: Rotina) {
  if (saving.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await rotinasApi.deactivate(row.id)
    success.value = 'Horário desativado.'
    await loadConfig()
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível desativar.'
  } finally {
    saving.value = false
  }
}
onMounted(async () => {
  void load()
  if (auth.isAdmin) await loadConfig()
})
</script>
<template>
  <div class="page-intro">
    <h1>Rotina de medições</h1>
    <BaseButton v-if="auth.isAdmin" @click="edit()">Novo horário</BaseButton>
  </div>
  <BaseAlert v-if="error" tone="error" title="Configuração de horários">{{ error }}</BaseAlert
  ><BaseAlert v-if="success" title="Alteração salva">{{ success }}</BaseAlert>
  <section v-if="showingForm && auth.isAdmin" class="data-panel record-panel">
    <h2>{{ editId ? 'Editar horário' : 'Novo horário' }}</h2>
    <form class="form-stack" @submit.prevent="save">
      <CultivoFilter
        v-model:viveiro-id="form.viveiroId"
        v-model:ciclo-id="form.cicloId"
        hide-cycle
        form
        global-label="Todos os viveiros (padrão)"
        :disabled="saving"
      /><BaseSelect
        v-model="form.parametroId"
        label="Parâmetro"
        name="parametroId"
        required
        :disabled="saving"
        ><option value="">Selecione o parâmetro</option>
        <option v-for="p in parameters" :key="p.id" :value="String(p.id)">
          {{ p.nome }}
        </option></BaseSelect
      >
      <div class="form-columns">
        <BaseField
          v-model="form.horario"
          label="Horário"
          type="time"
          required
          :disabled="saving"
        /><BaseField
          v-model="form.toleranciaMinutos"
          label="Tolerância antes e depois (min)"
          inputmode="numeric"
          required
          :disabled="saving"
        />
      </div>
      <BaseField v-model="form.fuso" label="Fuso horário" required :disabled="saving" />
      <div class="form-actions">
        <BaseButton type="submit" :disabled="saving">Salvar horário</BaseButton
        ><BaseButton variant="secondary" :disabled="saving" @click="showingForm = false"
          >Cancelar</BaseButton
        >
      </div>
    </form>
  </section>
  <section class="data-panel record-panel">
    <h2>Medições esperadas</h2>
    <form class="form-stack" @submit.prevent="load">
      <CultivoFilter
        v-model:viveiro-id="filter.viveiroId"
        v-model:ciclo-id="filter.cicloId"
      /><BaseField v-model="filter.data" label="Dia" type="date" required />
      <div>
        <BaseButton type="submit" variant="secondary" :disabled="loading">Consultar</BaseButton>
      </div>
    </form>
    <BaseLoading v-if="loading" /><BaseAlert
      v-else-if="pendingError"
      tone="error"
      title="Não foi possível carregar"
      >{{ pendingError }}</BaseAlert
    ><template v-else
      ><p>
        <strong>{{ data.total }}</strong> medições pendentes
      </p>
      <p v-if="!data.pendencias.length" class="empty-message">
        Nenhum horário aplicável aos ciclos ativos.
      </p>
      <div v-else class="table-scroll">
        <table class="records-table">
          <thead>
            <tr>
              <th>Viveiro / ciclo</th>
              <th>Parâmetro</th>
              <th>Horário / fuso</th>
              <th>Situação</th>
              <th>Medição</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.pendencias" :key="`${row.cicloId}-${row.rotinaId}`">
              <td>{{ row.viveiro }} / #{{ row.cicloId }}</td>
              <td>{{ row.parametro.nome }}</td>
              <td>
                {{ row.horario }}<br /><small>{{ row.fuso }}</small>
              </td>
              <td>
                {{
                  row.situacao === 'CONCLUIDA'
                    ? 'Registrada'
                    : row.situacao === 'PENDENTE'
                      ? 'Pendente'
                      : 'Aguardando'
                }}
              </td>
              <td v-if="row.medicao">
                {{ row.medicao.valor }} {{ row.medicao.unidade }}<br /><small>{{
                  dateTime(row.medicao.medidoEm)
                }}</small>
              </td>
              <td v-else>
                <RouterLink
                  :to="`/medicoes?viveiroId=${row.viveiroId}&cicloId=${row.cicloId}`"
                  class="text-link"
                  >Registrar medição</RouterLink
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div></template
    >
  </section>
  <section v-if="auth.isAdmin" class="data-panel record-panel">
    <h2>Horários configurados</h2>
    <p v-if="!routines.length" class="empty-message">Nenhum horário configurado.</p>
    <div v-else class="table-scroll">
      <table class="records-table">
        <thead>
          <tr>
            <th>Viveiro</th>
            <th>Parâmetro</th>
            <th>Horário / fuso</th>
            <th>Janela</th>
            <th>Situação</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in routines" :key="row.id">
            <td>{{ row.viveiro?.identificador || 'Todos (padrão)' }}</td>
            <td>{{ row.parametro.nome }}</td>
            <td>
              {{ row.horario }}<br /><small>{{ row.fuso }}</small>
            </td>
            <td>± {{ row.toleranciaMinutos }} min</td>
            <td>{{ row.ativo ? 'Ativo' : 'Inativo' }}</td>
            <td>
              <div class="inline-actions">
                <BaseButton
                  size="small"
                  variant="secondary"
                  :disabled="saving"
                  @click="edit(row)"
                  >{{ row.ativo ? 'Editar' : 'Editar e ativar' }}</BaseButton
                ><BaseButton
                  v-if="row.ativo"
                  size="small"
                  variant="secondary"
                  :disabled="saving"
                  @click="deactivate(row)"
                  >Desativar</BaseButton
                >
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
