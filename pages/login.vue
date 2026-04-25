<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const api = useApi()

const username = ref('')
const password = ref('')
const submitting = ref(false)

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    await api.post('/api/auth/login', {
      username: username.value.trim(),
      password: password.value,
    })
    await refreshSession()
    const next = (route.query.next as string) || '/'
    await navigateTo(next)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-lg font-semibold">Sign in</h1>
    </template>
    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <UFormField label="Username" required>
        <UInput
          v-model="username"
          autocomplete="username"
          autocapitalize="off"
          autocorrect="off"
          :ui="{ base: 'w-full' }"
        />
      </UFormField>
      <UFormField label="Password" required>
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
        label="Sign in"
      />
    </form>
    <template #footer>
      <p class="text-sm text-muted">
        New here?
        <NuxtLink to="/register" class="text-primary font-medium">Create an account</NuxtLink>
      </p>
    </template>
  </UCard>
</template>
