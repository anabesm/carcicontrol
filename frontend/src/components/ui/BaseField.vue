<script setup lang="ts">
import { computed, ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    id?: string
    label: string
    type?: 'text' | 'email' | 'password' | 'search' | 'number' | 'tel' | 'date'
    placeholder?: string
    hint?: string
    error?: string
    required?: boolean
    disabled?: boolean
    hideLabel?: boolean
    autocomplete?: string
    name?: string
    maxlength?: number
    minlength?: number
    min?: string
    max?: string
    inputmode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'search'
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
    <div
      class="field-control"
      :class="{ 'field-control--icon': $slots.leading, 'field-control--trailing': $slots.trailing }"
    >
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
        :name="name"
        :maxlength="maxlength"
        :minlength="minlength"
        :min="min"
        :max="max"
        :inputmode="inputmode"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="model = ($event.target as HTMLInputElement).value"
      />
      <span v-if="$slots.trailing" class="field-trailing"><slot name="trailing" /></span>
    </div>
    <p v-if="hint" :id="`${fieldId}-hint`" class="field-hint">{{ hint }}</p>
    <p v-if="error" :id="`${fieldId}-error`" class="field-error" role="alert">{{ error }}</p>
  </div>
</template>
