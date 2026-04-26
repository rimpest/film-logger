<script setup lang="ts">
const { user, clear } = useUserSession()
const route = useRoute()
const { t } = useI18n()

const items = computed(() => [
  { label: t('nav.home'), icon: 'i-lucide-home', to: '/' },
  { label: t('nav.rolls'), icon: 'i-lucide-film', to: '/rolls' },
  { label: t('nav.log'), icon: 'i-lucide-plus-circle', to: '/log' },
  { label: t('nav.gear'), icon: 'i-lucide-camera', to: '/cameras' },
  { label: t('nav.labs'), icon: 'i-lucide-flask-conical', to: '/labs' },
])

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  // Wipe the local cache + encryption key so a different user signing in
  // can't read the previous account's data.
  if (import.meta.client) {
    await localStore.clear()
    await clearKey()
  }
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-20 border-b border-default bg-default/80 backdrop-blur safe-top">
      <div class="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
        <NuxtLink to="/" class="font-semibold tracking-tight text-lg">
          {{ t('appName') }}
        </NuxtLink>
        <div class="flex items-center gap-2">
          <UDropdownMenu
            v-if="user"
            :items="[
              [{ label: user.username as string, type: 'label' }],
              [{ label: t('settings.title'), icon: 'i-lucide-settings', to: '/settings' }],
              [{ label: t('auth.signOut'), icon: 'i-lucide-log-out', onSelect: logout }],
            ]"
          >
            <UButton
              :label="(user.username as string)"
              icon="i-lucide-user"
              color="neutral"
              variant="ghost"
              size="sm"
            />
          </UDropdownMenu>
          <UButton
            v-else
            to="/login"
            :label="t('auth.signIn')"
            color="primary"
            size="sm"
          />
        </div>
      </div>
    </header>

    <main class="flex-1 mx-auto w-full max-w-3xl px-4 py-4 pb-24 sm:pb-8">
      <slot />
    </main>

    <nav
      v-if="user"
      class="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-default bg-default/95 backdrop-blur safe-bottom"
    >
      <ul class="grid grid-cols-5">
        <li v-for="item in items" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex flex-col items-center justify-center py-2 gap-0.5 text-xs"
            :class="route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))
              ? 'text-primary'
              : 'text-muted'"
          >
            <UIcon :name="item.icon" class="size-5" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
