<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 safe-top safe-bottom">
    <div class="w-full max-w-sm">
      <div class="text-center mb-6">
        <div class="text-2xl font-semibold tracking-tight">{{ t('appName') }}</div>
        <div class="text-sm text-muted">{{ t('tagline') }}</div>
      </div>
      <slot />
    </div>
  </div>
</template>
