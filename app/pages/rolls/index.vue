<script setup lang="ts">
import { deriveRollState, DERIVED_STATE_LABELS, DERIVED_STATE_COLORS, type DerivedRollState } from '~~/shared/roll-status'

const filter = ref<'all' | DerivedRollState>('all')
const { data: rolls } = useCachedRolls()

const filtered = computed(() => {
  const list = rolls.value
  if (filter.value === 'all') return list
  return list.filter(r =>
    deriveRollState({
      status: r.status,
      latest_development_status: r.latest_development_status as any,
    }) === filter.value,
  )
})

const filterOptions: Array<{ label: string, value: 'all' | DerivedRollState }> = [
  { label: 'All', value: 'all' },
  { label: 'Loaded', value: 'loaded' },
  { label: 'Finished', value: 'finished' },
  { label: 'At lab', value: 'at_lab' },
  { label: 'Developed', value: 'developed' },
  { label: 'Archived', value: 'archived' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Rolls</h1>
      <UButton to="/rolls/new" icon="i-lucide-plus" label="New roll" color="primary" />
    </header>

    <USelect
      v-model="filter"
      :items="filterOptions"
      class="w-full sm:w-48"
    />

    <div v-if="filtered.length" class="flex flex-col gap-2">
      <NuxtLink
        v-for="r in filtered"
        :key="r.id"
        :to="`/rolls/${r.id}`"
        class="block rounded-lg border border-default bg-elevated/40 p-4 hover:bg-elevated transition"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-medium truncate">{{ r.film_stock }}</div>
            <div class="text-sm text-muted truncate">
              {{ r.camera_name }} · ISO {{ r.iso }} · {{ r.shot_count }} / {{ r.frame_count }} shots
            </div>
            <div class="text-xs text-muted mt-1">
              Loaded {{ new Date(r.loaded_at).toLocaleDateString() }}
            </div>
          </div>
          <UBadge
            :color="DERIVED_STATE_COLORS[deriveRollState({ status: r.status, latest_development_status: r.latest_development_status as any })]"
            variant="subtle"
            :label="DERIVED_STATE_LABELS[deriveRollState({ status: r.status, latest_development_status: r.latest_development_status as any })]"
          />
        </div>
      </NuxtLink>
    </div>

    <UCard v-else>
      <div class="text-center py-6 text-muted">No rolls match this filter.</div>
    </UCard>
  </div>
</template>
