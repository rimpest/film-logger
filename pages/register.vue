<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { fetch: refreshSession } = useUserSession()
const api = useApi()

const username = ref('')
const password = ref('')
const confirm = ref('')
const submitting = ref(false)
const recoveryCode = ref<string | null>(null)

async function submit() {
  if (submitting.value) return
  if (password.value !== confirm.value) {
    useToast().add({ title: 'Passwords do not match', color: 'error' })
    return
  }
  submitting.value = true
  try {
    const res = await api.post<{ recovery_code: string }>(
      '/api/auth/register',
      { username: username.value.trim(), password: password.value },
    )
    await refreshSession()
    recoveryCode.value = res.recovery_code
  } finally {
    submitting.value = false
  }
}

async function done() {
  await navigateTo('/')
}
</script>

<template>
  <UCard v-if="!recoveryCode">
    <template #header>
      <h1 class="text-lg font-semibold">Create account</h1>
    </template>
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <UFormField label="Username" required help="Letters, numbers, and . _ - only.">
        <UInput
          v-model="username"
          autocomplete="username"
          autocapitalize="off"
          autocorrect="off"
          :ui="{ base: 'w-full' }"
        />
      </UFormField>
      <UFormField label="Password" required help="Minimum 8 characters.">
        <UInput v-model="password" type="password" autocomplete="new-password" :ui="{ base: 'w-full' }" />
      </UFormField>
      <UFormField label="Confirm password" required>
        <UInput v-model="confirm" type="password" autocomplete="new-password" :ui="{ base: 'w-full' }" />
      </UFormField>
      <UButton type="submit" :loading="submitting" block label="Create account" />
    </form>
    <template #footer>
      <p class="text-sm text-muted">
        Already have an account?
        <NuxtLink to="/login" class="text-primary font-medium">Sign in</NuxtLink>
      </p>
    </template>
  </UCard>

  <UCard v-else>
    <template #header>
      <h1 class="text-lg font-semibold">Save your recovery code</h1>
    </template>
    <UAlert
      icon="i-lucide-shield-alert"
      color="warning"
      variant="subtle"
      title="One-time only"
      description="We don't collect email, so this code is your only password reset path. Store it somewhere safe — we won't show it again."
    />
    <div class="my-4 p-4 rounded-md bg-elevated text-center font-mono text-lg tracking-widest break-all">
      {{ recoveryCode }}
    </div>
    <UButton block label="I've saved it — continue" @click="done" />
  </UCard>
</template>
