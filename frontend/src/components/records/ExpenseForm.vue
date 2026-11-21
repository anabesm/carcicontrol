<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { categories, despesasApi, type Categoria } from '@/services/despesas'
import { currency, decimal, today } from '@/utils/records'
import CultivoFilter from './CultivoFilter.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
const emit = defineEmits<{ saved: []; cancel: [] }>()
const form = reactive({
  viveiroId: '',
  cicloId: '',
  data: today(),
  fornecedorNome: '',
  numeroDocumento: '',
  formaPagamento: '',
  statusPagamento: 'PENDENTE',
  observacao: '',
})
const items = reactive([
  { categoria: 'RACAO' as Categoria, descricao: '', quantidade: '1', unidade: 'kg', valorUnit: '' },
])
const total = computed(() =>
  items.reduce((sum, item) => sum + (decimal(item.quantidade) * decimal(item.valorUnit) || 0), 0),
)
const saving = ref(false)
const error = ref('')
async function save() {
  if (saving.value) return
  error.value = ''
  if (
    items.some(
      (item) =>
        !item.descricao.trim() ||
        !item.unidade.trim() ||
        !(decimal(item.quantidade) > 0) ||
        !(decimal(item.valorUnit) > 0),
    )
  ) {
    error.value = 'Preencha descrição, unidade, quantidade e valor unitário positivos.'
    return
  }
  saving.value = true
  try {
    await despesasApi.create({
      ...form,
      viveiroId: form.viveiroId ? Number(form.viveiroId) : null,
      cicloId: form.cicloId ? Number(form.cicloId) : null,
      itens: items.map((item) => ({
        ...item,
        quantidade: decimal(item.quantidade),
        valorUnit: decimal(item.valorUnit),
      })),
    })
    emit('saved')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Não foi possível salvar a despesa.'
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <form class="form-stack" @submit.prevent="save">
    <BaseAlert v-if="error" title="Não foi possível salvar" tone="error">{{ error }}</BaseAlert>
    <CultivoFilter
      v-model:viveiro-id="form.viveiroId"
      v-model:ciclo-id="form.cicloId"
      form
      :disabled="saving"
    />
    <div class="form-columns">
      <BaseField
        v-model="form.data"
        label="Data"
        type="date"
        required
        :disabled="saving"
      /><BaseField
        v-model="form.fornecedorNome"
        label="Fornecedor"
        :maxlength="160"
        :disabled="saving"
      />
    </div>
    <fieldset v-for="(item, index) in items" :key="index" class="expense-item">
      <legend>Item {{ index + 1 }}</legend>
      <div class="form-columns">
        <BaseSelect v-model="item.categoria" label="Categoria" name="categoria" :disabled="saving"
          ><option v-for="(label, key) in categories" :key="key" :value="key">
            {{ label }}
          </option></BaseSelect
        ><BaseField
          v-model="item.descricao"
          label="Descrição"
          :maxlength="240"
          required
          :disabled="saving"
        />
      </div>
      <div class="expense-values">
        <BaseField
          v-model="item.quantidade"
          label="Quantidade"
          inputmode="decimal"
          required
          :disabled="saving"
        /><BaseField
          v-model="item.unidade"
          label="Unidade"
          :maxlength="30"
          required
          :disabled="saving"
        /><BaseField
          v-model="item.valorUnit"
          label="Valor unitário (R$)"
          inputmode="decimal"
          required
          :disabled="saving"
        />
      </div>
    </fieldset>
    <div class="form-columns">
      <BaseField
        v-model="form.numeroDocumento"
        label="Documento"
        :maxlength="80"
        :disabled="saving"
      /><BaseField
        v-model="form.formaPagamento"
        label="Forma de pagamento"
        :maxlength="80"
        :disabled="saving"
      />
    </div>
    <BaseSelect
      v-model="form.statusPagamento"
      label="Pagamento"
      name="statusPagamento"
      :disabled="saving"
      ><option value="PENDENTE">Pendente</option>
      <option value="PAGO">Pago</option></BaseSelect
    >
    <BaseField v-model="form.observacao" label="Observação" :maxlength="2000" :disabled="saving" />
    <strong>Total: {{ currency(total) }}</strong>
    <div class="form-actions">
      <BaseButton type="submit" :disabled="saving">{{
        saving ? 'Salvando…' : 'Salvar despesa'
      }}</BaseButton
      ><BaseButton variant="secondary" :disabled="saving" @click="emit('cancel')"
        >Cancelar</BaseButton
      >
    </div>
  </form>
</template>
