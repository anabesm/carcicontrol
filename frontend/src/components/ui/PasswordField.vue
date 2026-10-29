<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'
import BaseField from './BaseField.vue'

withDefaults(
  defineProps<{
    label: string
    name: string
    error?: string
    hint?: string
    disabled?: boolean
    autocomplete?: string
  }>(),
  { autocomplete: 'current-password' },
)
const model = defineModel<string>({ default: '' })
const visible = ref(false)
const field = ref<InstanceType<typeof BaseField>>()
defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <BaseField
    ref="field"
    v-model="model"
    :label="label"
    :name="name"
    :type="visible ? 'text' : 'password'"
    :error="error"
    :hint="hint"
    :disabled="disabled"
    :autocomplete="autocomplete"
    :maxlength="128"
    required
  >
    <template #trailing>
      <button
        type="button"
        class="password-toggle"
        :aria-label="`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`"
        :aria-pressed="visible"
        :disabled="disabled"
        @click="visible = !visible"
      >
        <component :is="visible ? EyeOff : Eye" :size="19" />
      </button>
    </template>
  </BaseField>
</template>
