<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  categories,
  despesasApi,
  type Categoria,
  type Despesa,
  type NewExpense,
} from '@/services/despesas'
import { currency, decimal, today } from '@/utils/records'
import CultivoFilter from './CultivoFilter.vue'
import BaseField from '@/components/ui/BaseField.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseAlert from '@/components/ui/BaseAlert.vue'
const emit = defineEmits<{ saved: []; cancel: [] }>()
const props = defineProps<{ initial?: Despesa }>()
const initial = props.initial
const form = reactive({
  viveiroId: initial?.viveiroId ? String(initial.viveiroId) : '',
  cicloId: initial?.cicloId ? String(initial.cicloId) : '',
  data: initial?.data.slice(0, 10) ?? today(),
  fornecedorNome: initial?.fornecedorNome ?? '',
  numeroDocumento: initial?.numeroDocumento ?? '',
  formaPagamento: initial?.formaPagamento ?? '',
  statusPagamento: initial?.statusPagamento ?? 'PENDENTE',
  observacao: initial?.observacao ?? '',
})
const newItem = () => ({
  categoria: 'RACAO' as Categoria,
  descricao: '',
  quantidade: '1',
  unidade: 'kg',
  valorUnit: '',
})
const items = reactive(
  initial?.itens.map((item) => ({
    categoria: item.categoria,
    descricao: item.descricao,
    quantidade: String(item.quantidade),
    unidade: item.unidade,
    valorUnit: String(item.valorUnit),
  })) ?? [newItem()],
)
const subtotal = (item: (typeof items)[number]) =>
  Math.round((decimal(item.quantidade) * decimal(item.valorUnit) + Number.EPSILON) * 100) / 100 || 0
const total = computed(() => items.reduce((sum, item) => sum + subtotal(item), 0))
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
    const input: NewExpense = {
      ...form,
      data: initial && form.data === initial.data.slice(0, 10) ? initial.data : form.data,
      viveiroId: form.viveiroId ? Number(form.viveiroId) : null,
      cicloId: form.cicloId ? Number(form.cicloId) : null,
      itens: items.map((item) => ({
        ...item,
        quantidade: decimal(item.quantidade),
        valorUnit: decimal(item.valorUnit),
      })),
    }
    if (initial) await despesasApi.update(initial.id, { ...input, versao: initial.versao })
    else await despesasApi.create(input)
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
      <div class="inline-actions">
        <strong>Subtotal: {{ currency(subtotal(item)) }}</strong
        ><BaseButton
          v-if="items.length > 1"
          variant="secondary"
          size="small"
          :disabled="saving"
          @click="items.splice(index, 1)"
          >Remover item {{ index + 1 }}</BaseButton
        >
      </div>
    </fieldset>
    <div>
      <BaseButton
        variant="secondary"
        :disabled="saving || items.length >= 100"
        @click="items.push(newItem())"
        >Adicionar item</BaseButton
      >
    </div>
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
