<script setup lang="ts">
import { deriveRollState, DERIVED_STATE_COLORS } from '~~/shared/roll-status'

const { t } = useI18n()

// Cache-first: hydrates from IndexedDB on mount, then revalidates from /api.
// Offline → silently keeps cached data, no flicker.
const { data: rolls, refresh } = useCachedRolls('active')

const loaded = computed(() => rolls.value.filter(r => r.status === 'loaded'))
const finished = computed(() => rolls.value.filter(r => r.status === 'finished'))
const { online, queue, flush } = useOfflineQueue()

watch(online, (val) => { if (val) void flush().then(refresh) })

function deriveFor(r: { status: string, latest_development_status: string | null, latest_development_lab_id: number | null }) {
  return deriveRollState({
    status: r.status as any,
    latest_development_status: r.latest_development_status as any,
    latest_development_lab_id: r.latest_development_lab_id,
  })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">{{ t('home.whatsLoaded') }}</h1>
        <p class="text-sm text-muted">{{ t('home.subtitle') }}</p>
      </div>
      <UButton to="/log" icon="i-lucide-plus" color="primary" :label="t('home.logShot')" />
    </section>

    <UAlert
      v-if="!online"
      icon="i-lucide-wifi-off"
      color="warning"
      variant="subtle"
      :title="t('home.offline')"
      :description="t('home.offlineHelp')"
    />
    <UAlert
      v-else-if="queue.length"
      icon="i-lucide-cloud-upload"
      color="info"
      variant="subtle"
      :title="t('home.pendingSync', { count: queue.length }, queue.length)"
      :description="t('home.pendingSyncHelp')"
    />

    <section v-if="loaded.length" class="flex flex-col gap-3">
      <h2 class="text-sm font-medium text-muted uppercase tracking-wide">{{ t('home.loaded') }}</h2>
      <NuxtLink
        v-for="r in loaded"
        :key="r.id"
        :to="`/rolls/${r.id}`"
        class="block rounded-lg border border-default bg-elevated/40 p-4 hover:bg-elevated transition"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium truncate">{{ r.film_stock }}</div>
            <div class="text-sm text-muted truncate">
              {{ r.camera_name }} · ISO {{ r.iso }} · {{ r.frame_count }} {{ t('home.framesShort') }}
            </div>
          </div>
          <UBadge
            :color="DERIVED_STATE_COLORS[deriveFor(r)]"
            variant="subtle"
            :label="t(`rollStatus.${deriveFor(r)}`)"
          />
        </div>
        <div class="mt-2 text-xs text-muted">
          {{ t('home.framesLogged', { logged: r.shot_count, total: r.frame_count }) }}
        </div>
      </NuxtLink>
    </section>

    <section v-if="finished.length" class="flex flex-col gap-3">
      <h2 class="text-sm font-medium text-muted uppercase tracking-wide">{{ t('home.finishedSection') }}</h2>
      <NuxtLink
        v-for="r in finished"
        :key="r.id"
        :to="`/rolls/${r.id}`"
        class="block rounded-lg border border-default bg-elevated/40 p-4 hover:bg-elevated transition"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium truncate">{{ r.film_stock }}</div>
            <div class="text-sm text-muted truncate">
              {{ r.camera_name }} · {{ r.shot_count }} {{ t('home.shotsShort') }}
            </div>
          </div>
          <UBadge
            :color="DERIVED_STATE_COLORS[deriveFor(r)]"
            variant="subtle"
            :label="t(`rollStatus.${deriveFor(r)}`)"
          />
        </div>
      </NuxtLink>
    </section>

    <UCard v-if="!loaded.length && !finished.length">
      <div class="flex flex-col items-center text-center gap-3 py-6">
        <UIcon name="i-lucide-film" class="size-10 text-muted" />
        <div>
          <p class="font-medium">{{ t('home.noActiveRolls') }}</p>
          <p class="text-sm text-muted">{{ t('home.noActiveRollsHelp') }}</p>
        </div>
        <div class="flex gap-2">
          <UButton to="/cameras" variant="outline" :label="t('home.cameras')" />
          <UButton to="/rolls/new" color="primary" :label="t('home.loadARoll')" />
        </div>
      </div>
    </UCard>
  </div>
</template>
