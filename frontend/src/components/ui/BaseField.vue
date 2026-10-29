<script setup lang="ts">
import { computed, ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    id?: string
    label: string
    type?: 'text' | 'email' | 'password' | 'search' | 'number' | 'tel'
    placeholder?: string
    hint?: string
    error?: string
    required?: boolean
    disabled?: boolean
    hideLabel?: boolean
    autocomplete?: string
  }>(),
  { type: 'text', required: false, disabled: false, hideLabel: false },
)

const model = defineModel<string>({ default: '' })
const generatedId = useId()
const fieldId = computed(() => props.id ?? generatedId)
const describedBy = computed(
  () =>
    [props.hint ? `${fieldId.value}-hint` : '', props.error ? `${fieldId.value}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined,
)
const input = ref<HTMLInputElement>()
defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label :for="fieldId" class="field-label" :class="{ 'sr-only': hideLabel }">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </label>
    <div class="field-control" :class="{ 'field-control--icon': $slots.leading }">
      <span v-if="$slots.leading" class="field-icon" aria-hidden="true"
        ><slot name="leading"
      /></span>
      <input
        :id="fieldId"
        ref="input"
        :value="model"
        :type="type"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="model = ($event.target as HTMLInputElement).value"
      />
    </div>
    <p v-if="hint" :id="`${fieldId}-hint`" class="field-hint">{{ hint }}</p>
    <p v-if="error" :id="`${fieldId}-error`" class="field-error" role="alert">{{ error }}</p>
  </div>
</template>
