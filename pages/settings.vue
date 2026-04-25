<script setup lang="ts">
const { user, clear } = useUserSession()
const api = useApi()
const toast = useToast()

const current = ref('')
const next = ref('')
const confirm = ref('')
const submitting = ref(false)

async function changePassword() {
  if (next.value !== confirm.value) {
    toast.add({ title: 'Passwords do not match', color: 'error' })
    return
  }
  submitting.value = true
  try {
    await api.post('/api/auth/change-password', {
      current_password: current.value,
      new_password: next.value,
    })
    toast.add({ title: 'Password updated', color: 'success' })
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
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-md">
    <h1 class="text-xl font-semibold">Settings</h1>

    <UCard>
      <template #header>
        <div class="text-sm font-medium">Account</div>
      </template>
      <p class="text-sm text-muted">Signed in as <span class="font-mono">{{ user?.username }}</span></p>
      <UButton class="mt-3" icon="i-lucide-log-out" variant="outline" label="Sign out" @click="logout" />
    </UCard>

    <UCard>
      <template #header>
        <div class="text-sm font-medium">Change password</div>
      </template>
      <form class="flex flex-col gap-3" @submit.prevent="changePassword">
        <UFormField label="Current password" required>
          <UInput v-model="current" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>
        <UFormField label="New password" required>
          <UInput v-model="next" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UFormField label="Confirm new password" required>
          <UInput v-model="confirm" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UButton type="submit" :loading="submitting" label="Update password" color="primary" />
      </form>
    </UCard>
  </div>
</template>
