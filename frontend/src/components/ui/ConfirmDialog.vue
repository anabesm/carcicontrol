<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import BaseButton from './BaseButton.vue'
const props = withDefaults(
  defineProps<{ open: boolean; title: string; busy?: boolean; confirmLabel?: string }>(),
  { confirmLabel: 'Confirmar', busy: false },
)
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const dialog = ref<HTMLDialogElement>()
watch(
  () => props.open,
  async (open) => {
    await nextTick()
    if (open && !dialog.value?.open) dialog.value?.showModal()
    else if (!open) dialog.value?.close()
  },
)
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <dialog
    ref="dialog"
    class="confirm-dialog"
    aria-labelledby="confirmation-title"
    @cancel.prevent="!busy && emit('cancel')"
  >
    <h2 id="confirmation-title">{{ title }}</h2>
    <div class="confirmation-content"><slot /></div>
    <div class="form-actions">
      <BaseButton :disabled="busy" @click="emit('confirm')">{{
        busy ? 'Salvando…' : confirmLabel
      }}</BaseButton
      ><BaseButton variant="secondary" :disabled="busy" @click="emit('cancel')"
        >Voltar e corrigir</BaseButton
      >
    </div>
  </dialog>
</template>
