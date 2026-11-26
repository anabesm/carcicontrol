<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useResource } from '@/composables/useResource'
import { eventosApi } from '@/services/eventos'
import { dateTime, localNow, queryString } from '@/utils/records'
import CultivoFilter from '@/components/records/CultivoFilter.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
const auth = useAuthStore()
const filter = reactive({ viveiroId: '', cicloId: '' })
const form = reactive({ viveiroId: '', cicloId: '', tipo: '', descricao: '', dataHora: localNow() })
const showingForm = ref(auth.isAdmin && useRoute().query.novo === '1')
const saving = ref(false)
const message = ref('')
const success = ref('')
const offset = ref(0)
const { data, loading, error, load } = useResource(
  () => eventosApi.list(queryString({ ...filter, offset: offset.value })),
  { eventos: [], total: 0 },
)
async function search() {
  offset.value = 0
  await load()
}
async function save() {
  if (saving.value) return
  message.value = ''
  success.value = ''
  if (
    !form.viveiroId ||
    !form.tipo.trim() ||
    !form.descricao.trim() ||
    !Number.isFinite(new Date(form.dataHora).getTime())
  ) {
    message.value = 'Preencha viveiro, tipo, descrição e uma data/hora válida.'
    return
  }
  saving.value = true
  try {
    await eventosApi.create({
      ...form,
      viveiroId: Number(form.viveiroId),
      cicloId: form.cicloId ? Number(form.cicloId) : null,
      dataHora: new Date(form.dataHora).toISOString(),
    })
    showingForm.value = false
    form.tipo = ''
    form.descricao = ''
    success.value = 'Ocorrência registrada.'
    await search()
  } catch (cause) {
    message.value = cause instanceof Error ? cause.message : 'Não foi possível salvar.'
  } finally {
    saving.value = false
  }
}
onMounted(load)
async function changePage(delta: number) {
  offset.value += delta
  await load()
}
</script>
<template>
  <div class="page-intro">
    <h1>Ocorrências</h1>
    <BaseButton v-if="auth.isAdmin" @click="showingForm = !showingForm">{{
      showingForm ? 'Fechar formulário' : 'Nova ocorrência'
    }}</BaseButton>
  </div>
  <BaseAlert v-if="success" title="Registro salvo">{{ success }}</BaseAlert>
  <section v-if="showingForm" class="data-panel record-panel">
    <h2>Nova ocorrência</h2>
    <BaseAlert v-if="message" title="Não foi possível registrar" tone="error">{{
      message
    }}</BaseAlert>
    <form class="form-stack" @submit.prevent="save">
      <CultivoFilter
        v-model:viveiro-id="form.viveiroId"
        v-model:ciclo-id="form.cicloId"
        required
        :disabled="saving"
      />
      <div class="form-columns">
        <BaseField
          v-model="form.tipo"
          label="Tipo"
          required
          :maxlength="80"
          :disabled="saving"
        /><BaseField
          v-model="form.dataHora"
          type="datetime-local"
          label="Data e hora"
          required
          :disabled="saving"
        />
      </div>
      <label class="field-label" for="event-description">Descrição *</label
      ><textarea
        id="event-description"
        v-model="form.descricao"
        required
        maxlength="2000"
        rows="3"
        :disabled="saving"
      ></textarea>
      <div class="form-actions">
        <BaseButton type="submit" :disabled="saving">{{
          saving ? 'Salvando…' : 'Registrar ocorrência'
        }}</BaseButton>
      </div>
    </form>
  </section>
  <section class="data-panel record-panel">
    <form class="form-stack" @submit.prevent="search">
      <CultivoFilter v-model:viveiro-id="filter.viveiroId" v-model:ciclo-id="filter.cicloId" />
      <div>
        <BaseButton type="submit" variant="secondary" :disabled="loading">Filtrar</BaseButton>
      </div>
    </form>
    <BaseLoading v-if="loading" />
    <BaseAlert v-else-if="error" title="Não foi possível carregar" tone="error"
      >{{ error
      }}<BaseButton variant="secondary" @click="load">Tentar novamente</BaseButton></BaseAlert
    >
    <p v-else-if="!data.eventos.length" class="empty-message">Nenhuma ocorrência encontrada.</p>
    <div v-else class="table-scroll">
      <table class="records-table">
        <thead>
          <tr>
            <th>Data/hora</th>
            <th>Viveiro / ciclo</th>
            <th>Tipo e descrição</th>
            <th>Responsável</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data.eventos" :key="row.id">
            <td>{{ dateTime(row.dataHora) }}</td>
            <td>
              {{ row.viveiro.identificador }}<br />{{
                row.cicloId ? `Ciclo #${row.cicloId}` : 'Sem ciclo'
              }}
            </td>
            <td>
              <strong>{{ row.tipo }}</strong>
              <p class="preserve-text">{{ row.descricao }}</p>
            </td>
            <td>{{ row.responsavel?.nome || 'Não informado' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="data.total > 50" class="record-pagination">
      <BaseButton variant="secondary" :disabled="offset === 0 || loading" @click="changePage(-50)"
        >Anterior</BaseButton
      ><span>{{ offset + 1 }}–{{ Math.min(offset + 50, data.total) }} de {{ data.total }}</span
      ><BaseButton
        variant="secondary"
        :disabled="offset + 50 >= data.total || loading"
        @click="changePage(50)"
        >Próxima</BaseButton
      >
    </div>
  </section>
</template>
