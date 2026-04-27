<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const api = useApi()
const { t } = useI18n()

const username = ref('')
const password = ref('')
const submitting = ref(false)

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    const res = await api.post<{ key_salt: string | null }>('/api/auth/login', {
      username: username.value.trim(),
      password: password.value,
    })
    await refreshSession()
    // Derive the encryption key from the password before we lose it from
    // memory — the server only stored a hash of it.
    if (import.meta.client && res.key_salt) {
      await deriveAndStoreKey(password.value, res.key_salt)
    }
    const next = (route.query.next as string) || '/'
    await navigateTo(next)
  } finally {
    submitting.value = false
    password.value = ''
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-lg font-semibold">{{ t('auth.signIn') }}</h1>
    </template>
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <UFormField :label="t('auth.username')" required>
        <UInput
          v-model="username"
          autocomplete="username"
          autocapitalize="off"
          autocorrect="off"
          :ui="{ base: 'w-full' }"
        />
      </UFormField>
      <UFormField :label="t('auth.password')" required>
        <UInput
          v-model="password"
          type="password"
          autocomplete="current-password"
          :ui="{ base: 'w-full' }"
        />
      </UFormField>
      <UButton
        type="submit"
        :loading="submitting"
        block
        :label="t('auth.signIn')"
      />
    </form>
    <template #footer>
      <p class="text-sm text-muted">
        {{ t('auth.newAccountPrompt') }}
        <NuxtLink to="/register" class="text-primary font-medium">{{ t('auth.createAccount') }}</NuxtLink>
      </p>
    </template>
  </UCard>
</template>
