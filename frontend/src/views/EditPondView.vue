<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { viveirosApi } from '@/services/viveiros'
import type { DetalhesViveiro } from '@/types/viveiro'
import { positiveDecimal } from '@/utils/viveiros'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseLoading from '@/components/ui/BaseLoading.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
const props = defineProps<{ id: string }>()
const pond = ref<DetalhesViveiro | null>(null)
const form = reactive({ identificador: '', area: '', profundidadeMedia: '', localizacao: '' })
const status = ref('DISPONIVEL')
const confirmStatus = ref(false)
const loading = ref(true),
  saving = ref(false),
  error = ref(''),
  success = ref('')
async function load() {
  loading.value = true
  try {
    pond.value = (await viveirosApi.detail(props.id)).viveiro
    Object.assign(form, {
      identificador: pond.value.identificador,
      area: String(pond.value.area),
      profundidadeMedia: String(pond.value.profundidadeMedia),
      localizacao: pond.value.localizacao ?? '',
    })
    status.value = pond.value.status
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar.'
  } finally {
    loading.value = false
  }
}
async function save(changeStatus = false) {
  if (saving.value) return
  error.value = ''
  success.value = ''
  const area = positiveDecimal(form.area),
    profundidadeMedia = positiveDecimal(form.profundidadeMedia)
  if (
    !changeStatus &&
    (!form.identificador.trim() || area === null || profundidadeMedia === null)
  ) {
    error.value = 'Informe identificador, área e profundidade maiores que zero.'
    return
  }
  saving.value = true
  try {
    await viveirosApi.update(
      props.id,
      changeStatus
        ? { status: status.value }
        : { ...form, area, profundidadeMedia, localizacao: form.localizacao || null },
    )
    await load()
    success.value = 'Viveiro atualizado.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível atualizar.'
  } finally {
    saving.value = false
    confirmStatus.value = false
  }
}
onMounted(load)
</script>
<template>
  <RouterLink :to="`/viveiros/${id}`" class="text-link back-link">Voltar ao viveiro</RouterLink>
  <div class="page-intro"><h1>Editar viveiro</h1></div>
  <BaseLoading v-if="loading" /><BaseAlert
    v-if="error"
    title="Não foi possível concluir"
    tone="error"
    >{{ error }}</BaseAlert
  ><BaseAlert v-if="success" title="Alteração salva">{{ success }}</BaseAlert>
  <template v-if="!loading && pond"
    ><section class="data-panel record-panel">
      <form class="form-stack" @submit.prevent="save()">
        <BaseField
          v-model="form.identificador"
          label="Nome ou identificador"
          required
          :maxlength="80"
          :disabled="saving"
        />
        <div class="form-columns">
          <BaseField
            v-model="form.area"
            label="Área (m²)"
            inputmode="decimal"
            required
            :disabled="saving"
          /><BaseField
            v-model="form.profundidadeMedia"
            label="Profundidade média (m)"
            inputmode="decimal"
            required
            :disabled="saving"
          />
        </div>
        <BaseField
          v-model="form.localizacao"
          label="Localização"
          :maxlength="240"
          :disabled="saving"
        />
        <div><BaseButton type="submit" :disabled="saving">Salvar alterações</BaseButton></div>
      </form>
    </section>
    <section v-if="!pond.cicloAtivo" class="data-panel record-panel">
      <h2>Situação</h2>
      <div class="form-stack">
        <BaseSelect v-model="status" label="Situação do viveiro" name="status" :disabled="saving"
          ><option value="DISPONIVEL">Disponível</option>
          <option value="MANUTENCAO">Em manutenção</option>
          <option value="INATIVO">Inativo</option></BaseSelect
        >
        <div>
          <BaseButton
            variant="secondary"
            :disabled="saving || status === pond.status"
            @click="confirmStatus = true"
            >Alterar situação</BaseButton
          >
        </div>
      </div>
    </section></template
  >
  <ConfirmDialog
    :open="confirmStatus"
    title="Alterar situação do viveiro"
    :busy="saving"
    @cancel="confirmStatus = false"
    @confirm="save(true)"
    ><p>{{ pond?.identificador }}</p>
    <p>
      Nova situação:
      <strong>{{
        status === 'DISPONIVEL' ? 'Disponível' : status === 'INATIVO' ? 'Inativo' : 'Em manutenção'
      }}</strong
      >.
    </p></ConfirmDialog
  >
</template>
