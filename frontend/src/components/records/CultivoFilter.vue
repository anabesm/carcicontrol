<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
import { viveirosApi } from '@/services/viveiros'
import type { Viveiro, CicloCultivo } from '@/types/viveiro'
const props = withDefaults(
  defineProps<{ required?: boolean; disabled?: boolean; form?: boolean }>(),
  { required: false, disabled: false, form: false },
)
const viveiroId = defineModel<string>('viveiroId', { default: '' })
const cicloId = defineModel<string>('cicloId', { default: '' })
const ponds = ref<Viveiro[]>([])
const cycles = ref<CicloCultivo[]>([])
const loading = ref(false)
const error = ref('')
let revision = 0
async function loadCycles() {
  const current = ++revision
  cycles.value = []
  if (!viveiroId.value) return
  loading.value = true
  try {
    const result = await viveirosApi.detail(viveiroId.value)
    if (current === revision) cycles.value = result.viveiro.ciclos
  } catch (cause) {
    if (current === revision)
      error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar os ciclos.'
  } finally {
    if (current === revision) loading.value = false
  }
}
watch(viveiroId, () => {
  cicloId.value = ''
  error.value = ''
  void loadCycles()
})
onMounted(async () => {
  try {
    ponds.value = (await viveirosApi.list()).viveiros
    await loadCycles()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar os viveiros.'
  }
})
</script>
<template>
  <BaseAlert v-if="error" tone="error" title="Viveiros e ciclos">{{ error }}</BaseAlert>
  <div class="form-columns">
    <BaseSelect
      v-model="viveiroId"
      label="Viveiro"
      name="viveiroId"
      :required="props.required"
      :disabled="disabled"
    >
      <option value="">
        {{ required ? 'Selecione o viveiro' : form ? 'Despesa geral' : 'Todos os viveiros' }}
      </option>
      <option v-for="pond in ponds" :key="pond.id" :value="String(pond.id)">
        {{ pond.identificador }}
      </option>
    </BaseSelect>
    <BaseSelect
      v-model="cicloId"
      label="Ciclo"
      name="cicloId"
      :disabled="disabled || !viveiroId || loading"
    >
      <option value="">
        {{
          viveiroId
            ? form || required
              ? 'Sem vínculo com ciclo'
              : 'Todos os ciclos'
            : 'Selecione um viveiro'
        }}
      </option>
      <option v-for="cycle in cycles" :key="cycle.id" :value="String(cycle.id)">
        #{{ cycle.id }} — {{ cycle.status === 'ATIVO' ? 'Ativo' : 'Encerrado' }}
      </option>
    </BaseSelect>
  </div>
</template>
