<script setup lang="ts">
import { computed, ref, useId } from 'vue'

const props = defineProps<{
  label: string
  name: string
  disabled?: boolean
  required?: boolean
  error?: string
}>()
const model = defineModel<string>({ default: '' })
const id = useId()
const input = ref<HTMLSelectElement>()
const errorId = computed(() => (props.error ? `${id}-error` : undefined))
defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label :for="id" class="field-label">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </label>
    <div class="field-control">
      <select
        :id="id"
        ref="input"
        v-model="model"
        :name="name"
        :disabled="disabled"
        :required="required"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="errorId"
      >
        <slot />
      </select>
    </div>
    <p v-if="error" :id="errorId" class="field-error" role="alert">{{ error }}</p>
  </div>
</template>
