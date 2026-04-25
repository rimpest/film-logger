<script setup lang="ts">
import type { RollListItem } from '~~/types/models'
import { deriveRollState, DERIVED_STATE_LABELS, DERIVED_STATE_COLORS } from '~~/shared/roll-status'

const { data: rolls, refresh } = await useFetch<RollListItem[]>('/api/rolls', {
  query: { status: 'active' },
  default: () => [],
})

const loaded = computed(() => (rolls.value ?? []).filter(r => r.status === 'loaded'))
const finished = computed(() => (rolls.value ?? []).filter(r => r.status === 'finished'))
const { online, queue, flush } = useOfflineQueue()

watch(online, (val) => { if (val) void flush().then(refresh) })
</script>

<template>
  <div class="flex flex-col gap-6">
    <section class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">What's loaded</h1>
        <p class="text-sm text-muted">Tap a roll to drill in, or jump straight to logging.</p>
      </div>
      <UButton to="/log" icon="i-lucide-plus" color="primary" label="Log a shot" />
    </section>

    <UAlert
      v-if="!online"
      icon="i-lucide-wifi-off"
      color="warning"
      variant="subtle"
      title="Offline"
      description="Shots you log will be saved locally and synced when you're back online."
    />
    <UAlert
      v-else-if="queue.length"
      icon="i-lucide-cloud-upload"
      color="info"
      variant="subtle"
      :title="`${queue.length} shot${queue.length === 1 ? '' : 's'} waiting to sync`"
      description="Pull to refresh once they're uploaded."
    />

    <section v-if="loaded.length" class="flex flex-col gap-3">
      <h2 class="text-sm font-medium text-muted uppercase tracking-wide">Loaded</h2>
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
              {{ r.camera_name }} · ISO {{ r.iso }} · {{ r.frame_count }} frames
            </div>
          </div>
          <UBadge
            :color="DERIVED_STATE_COLORS[deriveRollState({ status: r.status, latest_development_status: r.latest_development_status as any })]"
            variant="subtle"
            :label="DERIVED_STATE_LABELS[deriveRollState({ status: r.status, latest_development_status: r.latest_development_status as any })]"
          />
        </div>
        <div class="mt-2 text-xs text-muted">
          {{ r.shot_count }} / {{ r.frame_count }} logged
        </div>
      </NuxtLink>
    </section>

    <section v-if="finished.length" class="flex flex-col gap-3">
      <h2 class="text-sm font-medium text-muted uppercase tracking-wide">Finished, awaiting development</h2>
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
              {{ r.camera_name }} · {{ r.shot_count }} shots
            </div>
          </div>
          <UBadge
            :color="DERIVED_STATE_COLORS[deriveRollState({ status: r.status, latest_development_status: r.latest_development_status as any })]"
            variant="subtle"
            :label="DERIVED_STATE_LABELS[deriveRollState({ status: r.status, latest_development_status: r.latest_development_status as any })]"
          />
        </div>
      </NuxtLink>
    </section>

    <UCard v-if="!loaded.length && !finished.length">
      <div class="flex flex-col items-center text-center gap-3 py-6">
        <UIcon name="i-lucide-film" class="size-10 text-muted" />
        <div>
          <p class="font-medium">No active rolls</p>
          <p class="text-sm text-muted">Add a camera, then load a roll to start logging shots.</p>
        </div>
        <div class="flex gap-2">
          <UButton to="/cameras" variant="outline" label="Cameras" />
          <UButton to="/rolls/new" color="primary" label="Load a roll" />
        </div>
      </div>
    </UCard>
  </div>
</template>
