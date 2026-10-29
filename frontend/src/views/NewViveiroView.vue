<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue'
import { ArrowLeft, Plus } from '@lucide/vue'
import { useRouter } from 'vue-router'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseField from '@/components/ui/BaseField.vue'
import { viveirosApi } from '@/services/viveiros'
import { ApiError } from '@/services/api'
import { positiveDecimal } from '@/utils/viveiros'

const router = useRouter()
const form = reactive({ identificador: '', area: '', profundidadeMedia: '', localizacao: '' })
const errors = reactive({ identificador: '', area: '', profundidadeMedia: '', localizacao: '' })
type FieldName = keyof typeof form
const fields: Partial<Record<FieldName, { focus: () => void }>> = {}
const submitting = ref(false)
const errorMessage = ref('')
async function focusError() {
  await nextTick()
  const first = (Object.keys(errors) as FieldName[]).find((name) => errors[name])
  if (first) fields[first]?.focus()
}
async function submit() {
  if (submitting.value) return
  errorMessage.value = ''
  errors.identificador = !form.identificador.trim()
    ? 'Informe o nome ou identificador.'
    : form.identificador.trim().length > 80
      ? 'Use até 80 caracteres.'
      : ''
  const area = positiveDecimal(form.area)
  const profundidadeMedia = positiveDecimal(form.profundidadeMedia)
  errors.area = !form.area.trim()
    ? 'Informe a área.'
    : area === null
      ? 'Informe uma área maior que zero.'
      : ''
  errors.profundidadeMedia = !form.profundidadeMedia.trim()
    ? 'Informe a profundidade média.'
    : profundidadeMedia === null
      ? 'Informe uma profundidade maior que zero.'
      : ''
  errors.localizacao = form.localizacao.trim().length > 240 ? 'Use até 240 caracteres.' : ''
  if (Object.values(errors).some(Boolean)) {
    await focusError()
    return
  }
  submitting.value = true
  try {
    const result = await viveirosApi.create({
      identificador: form.identificador.trim(),
      area: area!,
      profundidadeMedia: profundidadeMedia!,
      localizacao: form.localizacao.trim() || null,
    })
    await router.replace({ name: 'detalhes-viveiro', params: { id: result.viveiro.id } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return
    if (error instanceof ApiError && error.status === 403) {
      await router.replace('/acesso-negado')
      return
    }
    if (error instanceof ApiError && error.status === 409) errors.identificador = error.message
    else
      errorMessage.value =
        error instanceof Error ? error.message : 'Não foi possível cadastrar o viveiro.'
  } finally {
    submitting.value = false
  }
  if (errors.identificador) await focusError()
}
</script>

<template>
  <RouterLink to="/viveiros" class="text-link back-link"
    ><ArrowLeft :size="16" />Viveiros e ciclos</RouterLink
  >
  <div class="page-intro">
    <div>
      <h1>Novo viveiro</h1>
    </div>
  </div>
  <div class="pond-form-layout">
    <section class="data-panel pond-form-panel" aria-labelledby="pond-form-heading">
      <div class="pond-panel-heading">
        <h2 id="pond-form-heading">Dados do viveiro</h2>
        <p>Os campos com * são obrigatórios.</p>
      </div>
      <BaseAlert
        v-if="errorMessage"
        title="Não foi possível cadastrar"
        tone="error"
        class="form-notice"
        >{{ errorMessage }}</BaseAlert
      >
      <form class="form-stack" novalidate :aria-busy="submitting" @submit.prevent="submit">
        <BaseField
          :ref="
            (el) => {
              if (el) fields.identificador = el as InstanceType<typeof BaseField>
            }
          "
          v-model="form.identificador"
          label="Nome ou identificador"
          name="identificador"
          placeholder="Ex.: Viveiro 01"
          hint="Use um nome exclusivo para identificar esta área."
          :maxlength="80"
          :error="errors.identificador"
          :disabled="submitting"
          required
        />
        <div class="form-columns">
          <BaseField
            :ref="
              (el) => {
                if (el) fields.area = el as InstanceType<typeof BaseField>
              }
            "
            v-model="form.area"
            label="Área (m²)"
            name="area"
            inputmode="decimal"
            placeholder="Ex.: 1500"
            :error="errors.area"
            :disabled="submitting"
            required
          />
          <BaseField
            :ref="
              (el) => {
                if (el) fields.profundidadeMedia = el as InstanceType<typeof BaseField>
              }
            "
            v-model="form.profundidadeMedia"
            label="Profundidade média (m)"
            name="profundidadeMedia"
            inputmode="decimal"
            placeholder="Ex.: 1,5"
            :error="errors.profundidadeMedia"
            :disabled="submitting"
            required
          />
        </div>
        <p class="form-help">Use vírgula ou ponto para decimais, sem separador de milhar.</p>
        <BaseField
          :ref="
            (el) => {
              if (el) fields.localizacao = el as InstanceType<typeof BaseField>
            }
          "
          v-model="form.localizacao"
          label="Localização (opcional)"
          name="localizacao"
          placeholder="Ex.: Setor norte"
          :maxlength="240"
          :error="errors.localizacao"
          :disabled="submitting"
        />
        <div class="form-actions">
          <BaseButton type="submit" :loading="submitting"
            ><Plus v-if="!submitting" :size="17" />{{
              submitting ? 'Cadastrando…' : 'Cadastrar viveiro'
            }}</BaseButton
          ><BaseButton to="/viveiros" variant="ghost" :disabled="submitting">Cancelar</BaseButton>
        </div>
      </form>
    </section>
  </div>
</template>
