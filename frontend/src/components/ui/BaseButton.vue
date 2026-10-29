<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import { LoaderCircle } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    to?: RouteLocationRaw
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'normal' | 'small'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
  }>(),
  { variant: 'primary', size: 'normal', type: 'button', disabled: false, loading: false },
)

const isLink = computed(() => Boolean(props.to) && !props.disabled && !props.loading)
const bindings = computed(() =>
  isLink.value
    ? { to: props.to! }
    : { type: props.type, disabled: props.disabled || props.loading },
)
</script>

<template>
  <component
    :is="isLink ? RouterLink : 'button'"
    v-bind="bindings"
    class="button"
    :class="[`button--${variant}`, `button--${size}`]"
    :aria-busy="loading || undefined"
  >
    <LoaderCircle v-if="loading" :size="17" class="spin" />
    <slot />
  </component>
</template>
