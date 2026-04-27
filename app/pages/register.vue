<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { fetch: refreshSession } = useUserSession()
const api = useApi()
const { t } = useI18n()

const username = ref('')
const password = ref('')
const confirm = ref('')
const submitting = ref(false)
const recoveryCode = ref<string | null>(null)

async function submit() {
  if (submitting.value) return
  if (password.value !== confirm.value) {
    useToast().add({ title: t('auth.passwordsDontMatch'), color: 'error' })
    return
  }
  submitting.value = true
  try {
    const res = await api.post<{ recovery_code: string, key_salt: string }>(
      '/api/auth/register',
      { username: username.value.trim(), password: password.value },
    )
    await refreshSession()
    // Derive the encryption key from the password while we still have it in
    // memory. After this, the password is forgotten — only the derived
    // (non-extractable) AES key persists.
    if (import.meta.client) {
      await deriveAndStoreKey(password.value, res.key_salt)
    }
    recoveryCode.value = res.recovery_code
  } finally {
    submitting.value = false
    password.value = ''
    confirm.value = ''
  }
}

async function done() {
  await navigateTo('/')
}
</script>

<template>
  <UCard v-if="!recoveryCode">
    <template #header>
      <h1 class="text-lg font-semibold">{{ t('auth.createAccount') }}</h1>
    </template>
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <UFormField :label="t('auth.username')" required :help="t('auth.usernameHelp')">
        <UInput
          v-model="username"
          autocomplete="username"
          autocapitalize="off"
          autocorrect="off"
          :ui="{ base: 'w-full' }"
        />
      </UFormField>
      <UFormField :label="t('auth.password')" required :help="t('auth.passwordHelp')">
        <UInput v-model="password" type="password" autocomplete="new-password" :ui="{ base: 'w-full' }" />
      </UFormField>
      <UFormField :label="t('auth.confirmPassword')" required>
        <UInput v-model="confirm" type="password" autocomplete="new-password" :ui="{ base: 'w-full' }" />
      </UFormField>
      <UButton type="submit" :loading="submitting" block :label="t('auth.createAccount')" />
    </form>
    <template #footer>
      <p class="text-sm text-muted">
        {{ t('auth.haveAccountPrompt') }}
        <NuxtLink to="/login" class="text-primary font-medium">{{ t('auth.signIn') }}</NuxtLink>
      </p>
    </template>
  </UCard>

  <UCard v-else>
    <template #header>
      <h1 class="text-lg font-semibold">{{ t('auth.saveRecoveryCode') }}</h1>
    </template>
    <UAlert
      icon="i-lucide-shield-alert"
      color="warning"
      variant="subtle"
      :title="t('auth.recoveryOneTime')"
      :description="t('auth.recoveryWarning')"
    />
    <div class="my-4 p-4 rounded-md bg-elevated text-center font-mono text-lg tracking-widest break-all">
      {{ recoveryCode }}
    </div>
    <UButton block :label="t('auth.savedItContinue')" @click="done" />
  </UCard>
</template>
