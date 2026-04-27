<script setup lang="ts">
const { user, clear } = useUserSession()
const api = useApi()
const toast = useToast()
const { t, locale, locales, setLocale } = useI18n()

const current = ref('')
const next = ref('')
const confirm = ref('')
const submitting = ref(false)

async function changePassword() {
  if (next.value !== confirm.value) {
    toast.add({ title: t('auth.passwordsDontMatch'), color: 'error' })
    return
  }
  submitting.value = true
  try {
    await api.post('/api/auth/change-password', {
      current_password: current.value,
      new_password: next.value,
    })
    toast.add({ title: t('settings.updated'), color: 'success' })
    current.value = ''
    next.value = ''
    confirm.value = ''
  } finally {
    submitting.value = false
  }
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  if (import.meta.client) {
    await localStore.clear()
    await clearKey()
  }
  await navigateTo('/login')
}

// Persisted via the i18n_redirected cookie automatically; setLocale also
// updates the active locale immediately.
const localeOptions = computed(() =>
  (locales.value as Array<{ code: string, name: string }>).map(l => ({
    label: l.name,
    value: l.code,
  })),
)
async function onLocaleChange(code: string) {
  await setLocale(code as 'en' | 'es')
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-md">
    <h1 class="text-xl font-semibold">{{ t('settings.title') }}</h1>

    <UCard>
      <template #header>
        <div class="text-sm font-medium">{{ t('settings.account') }}</div>
      </template>
      <p class="text-sm text-muted">
        {{ t('settings.signedInAs', { username: user?.username }) }}
      </p>
      <UButton class="mt-3" icon="i-lucide-log-out" variant="outline" :label="t('auth.signOut')" @click="logout" />
    </UCard>

    <UCard>
      <template #header>
        <div class="text-sm font-medium">{{ t('settings.language') }}</div>
      </template>
      <USelect
        :model-value="locale"
        :items="localeOptions"
        class="w-full"
        @update:model-value="onLocaleChange"
      />
    </UCard>

    <UCard>
      <template #header>
        <div class="text-sm font-medium">{{ t('settings.changePassword') }}</div>
      </template>
      <form class="flex flex-col gap-3" @submit.prevent="changePassword">
        <UFormField :label="t('settings.currentPassword')" required>
          <UInput v-model="current" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>
        <UFormField :label="t('settings.newPassword')" required>
          <UInput v-model="next" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UFormField :label="t('settings.confirmNewPassword')" required>
          <UInput v-model="confirm" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UButton type="submit" :loading="submitting" :label="t('settings.updatePassword')" color="primary" />
      </form>
    </UCard>
  </div>
</template>
