<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { faixasApi, type Faixa, type ParametroConfiguravel } from '@/services/faixas'
import { decimal } from '@/utils/records'
import CultivoFilter from '@/components/records/CultivoFilter.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
const parameters = ref<ParametroConfiguravel[]>([]),
  ranges = ref<Faixa[]>([])
const previousId = ref<number>(),
  deactivating = ref<Faixa | null>(null)
const showingForm = ref(false),
  byPhase = ref(false),
  history = ref(false)
const loading = ref(true),
  saving = ref(false),
  error = ref(''),
  success = ref('')
const ammonia = reactive({
  minPossivel: '',
  maxPossivel: '',
  minIdeal: '',
  maxIdeal: '',
  demonstrativa: true,
})
const showAmmonia = ref(false)
async function createAmmonia() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await faixasApi.createAmmonia({
      minPossivel: decimal(ammonia.minPossivel),
      maxPossivel: decimal(ammonia.maxPossivel),
      minIdeal: decimal(ammonia.minIdeal),
      maxIdeal: decimal(ammonia.maxIdeal),
      demonstrativa: ammonia.demonstrativa,
    })
    showAmmonia.value = false
    success.value = 'Amônia cadastrada para medições, alertas e gráficos.'
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível cadastrar o parâmetro.'
  } finally {
    saving.value = false
  }
}
const form = reactive({
  parametroId: '',
  viveiroId: '',
  cicloId: '',
  minIdeal: '',
  maxIdeal: '',
  minCritico: '',
  maxCritico: '',
  faseNome: '',
  diaInicial: '0',
  diaFinal: '',
  descricao: '',
  demonstrativa: false,
  minAcaoRecomendada: '',
  maxAcaoRecomendada: '',
})
const parameter = computed(() => parameters.value.find((p) => String(p.id) === form.parametroId))
const visible = computed(() => ranges.value.filter((row) => history.value || row.ativo))
async function load() {
  loading.value = true
  try {
    const [catalog, list] = await Promise.all([faixasApi.catalog(), faixasApi.list()])
    parameters.value = catalog.parametros
    ranges.value = list.faixas
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar as faixas.'
  } finally {
    loading.value = false
  }
}
function edit(row?: Faixa) {
  previousId.value = row?.id
  byPhase.value = Boolean(row?.faseNome)
  error.value = ''
  success.value = ''
  Object.assign(form, {
    parametroId: row ? String(row.parametroId) : '',
    viveiroId: row?.viveiroId ? String(row.viveiroId) : '',
    cicloId: '',
    minIdeal: row ? String(row.minIdeal) : '',
    maxIdeal: row ? String(row.maxIdeal) : '',
    minCritico: row?.minCritico == null ? '' : String(row.minCritico),
    maxCritico: row?.maxCritico == null ? '' : String(row.maxCritico),
    faseNome: row?.faseNome ?? '',
    diaInicial: String(row?.diaInicial ?? 0),
    diaFinal: row?.diaFinal == null ? '' : String(row.diaFinal),
    descricao: row?.descricao ?? '',
    demonstrativa: row?.demonstrativa ?? false,
    minAcaoRecomendada: row?.minAcaoRecomendada ?? '',
    maxAcaoRecomendada: row?.maxAcaoRecomendada ?? '',
  })
  showingForm.value = true
}
async function save() {
  if (saving.value) return
  error.value = ''
  success.value = ''
  saving.value = true
  try {
    await faixasApi.save(
      {
        parametroId: Number(form.parametroId),
        viveiroId: form.viveiroId ? Number(form.viveiroId) : null,
        minIdeal: decimal(form.minIdeal),
        maxIdeal: decimal(form.maxIdeal),
        minCritico: form.minCritico ? decimal(form.minCritico) : null,
        maxCritico: form.maxCritico ? decimal(form.maxCritico) : null,
        faseNome: byPhase.value ? form.faseNome : null,
        diaInicial: byPhase.value ? Number(form.diaInicial) : 0,
        diaFinal: byPhase.value && form.diaFinal ? Number(form.diaFinal) : null,
        descricao: form.descricao || null,
        demonstrativa: form.demonstrativa,
        minAcaoRecomendada: form.minAcaoRecomendada || null,
        maxAcaoRecomendada: form.maxAcaoRecomendada || null,
      },
      previousId.value,
    )
    showingForm.value = false
    success.value = 'Faixa salva. As versões anteriores foram preservadas.'
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível salvar.'
  } finally {
    saving.value = false
  }
}
async function deactivate() {
  if (saving.value || !deactivating.value) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await faixasApi.deactivate(deactivating.value.id)
    success.value = 'Faixa desativada.'
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível desativar.'
  } finally {
    saving.value = false
    deactivating.value = null
  }
}
onMounted(load)
</script>
<template>
  <div class="page-intro">
    <h1>Faixas de parâmetros</h1>
    <BaseButton @click="edit()">Nova faixa</BaseButton>
  </div>
  <BaseAlert v-if="error" tone="error" title="Configuração de faixas">{{ error }}</BaseAlert
  ><BaseAlert v-if="success" title="Alteração salva">{{ success }}</BaseAlert>
  <section
    v-if="!loading && !parameters.some((p) => p.codigo === 'NH3')"
    class="data-panel record-panel"
  >
    <BaseButton variant="secondary" :disabled="saving" @click="showAmmonia = !showAmmonia"
      >Cadastrar amônia (NH3)</BaseButton
    >
    <form v-if="showAmmonia" class="form-stack" @submit.prevent="createAmmonia">
      <h2>Amônia não ionizada (mg/L)</h2>
      <div class="form-columns">
        <BaseField
          v-model="ammonia.minPossivel"
          label="Mínimo de entrada (mg/L)"
          inputmode="decimal"
          required
          :disabled="saving"
        /><BaseField
          v-model="ammonia.maxPossivel"
          label="Máximo de entrada (mg/L)"
          inputmode="decimal"
          required
          :disabled="saving"
        />
      </div>
      <div class="form-columns">
        <BaseField
          v-model="ammonia.minIdeal"
          label="Mínimo ideal (mg/L)"
          inputmode="decimal"
          required
          :disabled="saving"
        /><BaseField
          v-model="ammonia.maxIdeal"
          label="Máximo ideal (mg/L)"
          inputmode="decimal"
          required
          :disabled="saving"
        />
      </div>
      <label class="checkbox-label"
        ><input v-model="ammonia.demonstrativa" type="checkbox" :disabled="saving" /> Faixa
        demonstrativa de exemplo</label
      >
      <div><BaseButton type="submit" :disabled="saving">Salvar parâmetro</BaseButton></div>
    </form>
  </section>
  <section v-if="showingForm" class="data-panel record-panel">
    <h2>{{ previousId ? 'Nova versão da faixa' : 'Nova faixa' }}</h2>
    <form class="form-stack" @submit.prevent="save">
      <CultivoFilter
        v-model:viveiro-id="form.viveiroId"
        v-model:ciclo-id="form.cicloId"
        form
        hide-cycle
        global-label="Todos os viveiros (padrão)"
        :disabled="saving"
      /><BaseSelect
        v-model="form.parametroId"
        label="Parâmetro"
        name="parametroId"
        required
        :disabled="saving"
        ><option value="">Selecione</option>
        <option v-for="p in parameters" :key="p.id" :value="String(p.id)">
          {{ p.nome }} ({{ p.unidadePadrao }})
        </option></BaseSelect
      >
      <p v-if="parameter">
        Limites de entrada: {{ parameter.minPossivel }} a {{ parameter.maxPossivel }}
        {{ parameter.unidadePadrao }}.
      </p>
      <div class="form-columns">
        <BaseField
          v-model="form.minIdeal"
          :label="`Mínimo ideal (${parameter?.unidadePadrao || 'unidade'})`"
          inputmode="decimal"
          required
          :disabled="saving"
        /><BaseField
          v-model="form.maxIdeal"
          :label="`Máximo ideal (${parameter?.unidadePadrao || 'unidade'})`"
          inputmode="decimal"
          required
          :disabled="saving"
        />
      </div>
      <div class="form-columns">
        <BaseField
          v-model="form.minCritico"
          label="Mínimo crítico (opcional)"
          inputmode="decimal"
          :disabled="saving"
        /><BaseField
          v-model="form.maxCritico"
          label="Máximo crítico (opcional)"
          inputmode="decimal"
          :disabled="saving"
        />
      </div>
      <label class="checkbox-label"
        ><input v-model="byPhase" type="checkbox" :disabled="saving" /> Aplicar a uma fase do
        cultivo</label
      ><template v-if="byPhase"
        ><BaseField
          v-model="form.faseNome"
          label="Nome da fase"
          required
          :maxlength="80"
          :disabled="saving" />
        <div class="form-columns">
          <BaseField
            v-model="form.diaInicial"
            label="Dia inicial (povoamento = 0)"
            inputmode="numeric"
            required
            :disabled="saving"
          /><BaseField
            v-model="form.diaFinal"
            label="Dia final (vazio = sem limite)"
            inputmode="numeric"
            :disabled="saving"
          /></div
      ></template>
      <BaseField v-model="form.descricao" label="Descrição" :maxlength="1000" :disabled="saving" />
      <div class="form-columns">
        <BaseField
          v-model="form.minAcaoRecomendada"
          label="Ação abaixo da faixa (opcional)"
          :maxlength="1000"
          :disabled="saving"
        /><BaseField
          v-model="form.maxAcaoRecomendada"
          label="Ação acima da faixa (opcional)"
          :maxlength="1000"
          :disabled="saving"
        />
      </div>
      <label class="checkbox-label"
        ><input v-model="form.demonstrativa" type="checkbox" :disabled="saving" /> Faixa
        demonstrativa de exemplo</label
      >
      <div class="form-actions">
        <BaseButton type="submit" :disabled="saving">Salvar faixa</BaseButton
        ><BaseButton variant="secondary" :disabled="saving" @click="showingForm = false"
          >Cancelar</BaseButton
        >
      </div>
    </form>
  </section>
  <section class="data-panel record-panel">
    <label class="checkbox-label"
      ><input v-model="history" type="checkbox" /> Mostrar versões anteriores e faixas
      inativas</label
    ><BaseLoading v-if="loading" />
    <p v-else-if="!visible.length" class="empty-message">Nenhuma faixa encontrada.</p>
    <div v-else class="table-scroll">
      <table class="records-table">
        <thead>
          <tr>
            <th>Parâmetro / unidade</th>
            <th>Viveiro / fase</th>
            <th>Ideal</th>
            <th>Crítico</th>
            <th>Situação</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="row.id">
            <td>
              {{ row.parametro.nome }}<br /><small
                >{{ row.parametro.unidadePadrao }}{{ row.demonstrativa ? ' — Exemplo' : '' }}</small
              >
            </td>
            <td>
              {{ row.viveiro?.identificador || 'Todos (padrão)' }}<br /><span v-if="row.faseNome"
                >{{ row.faseNome }}: dia {{ row.diaInicial }} a
                {{ row.diaFinal ?? 'sem limite' }}</span
              ><span v-else>Todas as fases</span>
            </td>
            <td>{{ row.minIdeal }} a {{ row.maxIdeal }}</td>
            <td>{{ row.minCritico ?? '—' }} / {{ row.maxCritico ?? '—' }}</td>
            <td>{{ row.ativo ? 'Ativa' : 'Inativa / anterior' }}</td>
            <td v-if="row.ativo">
              <div class="inline-actions">
                <BaseButton variant="secondary" size="small" :disabled="saving" @click="edit(row)"
                  >Editar</BaseButton
                ><BaseButton
                  variant="secondary"
                  size="small"
                  :disabled="saving"
                  @click="deactivating = row"
                  >Desativar</BaseButton
                >
              </div>
            </td>
            <td v-else></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
  <ConfirmDialog
    :open="Boolean(deactivating)"
    title="Desativar faixa"
    :busy="saving"
    @cancel="deactivating = null"
    @confirm="deactivate"
    ><p>
      {{ deactivating?.parametro.nome }} —
      {{ deactivating?.viveiro?.identificador || 'Todos os viveiros' }}.
    </p>
    <p>
      As medições anteriores manterão os limites registrados. Novas medições precisarão de outra
      faixa aplicável.
    </p></ConfirmDialog
  >
</template>
