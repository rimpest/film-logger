<script setup lang="ts">
import {
  ALL_DERIVED_STATES,
  DERIVED_STATE_COLORS,
  deriveRollState,
  type DerivedRollState,
} from '~~/shared/roll-status'

const { t, locale } = useI18n()
const filter = ref<'all' | DerivedRollState>('all')
const { data: rolls } = useCachedRolls()

function deriveFor(r: { status: string, latest_development_status: string | null, latest_development_lab_id: number | null }) {
  return deriveRollState({
    status: r.status as any,
    latest_development_status: r.latest_development_status as any,
    latest_development_lab_id: r.latest_development_lab_id,
  })
}

const filtered = computed(() => {
  const list = rolls.value
  if (filter.value === 'all') return list
  return list.filter(r => deriveFor(r) === filter.value)
})

const filterOptions = computed(() => [
  { label: t('rolls.filter.all'), value: 'all' as const },
  ...ALL_DERIVED_STATES.map(s => ({ label: t(`rollStatus.${s}`), value: s })),
])

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">{{ t('rolls.title') }}</h1>
      <UButton to="/rolls/new" icon="i-lucide-plus" :label="t('rolls.newRoll')" color="primary" />
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
              {{ r.camera_name }} · ISO {{ r.iso }} · {{ r.shot_count }} / {{ r.frame_count }} {{ t('home.shotsShort') }}
            </div>
            <div class="text-xs text-muted mt-1">
              {{ t('rolls.loadedAt', { date: fmtDate(r.loaded_at) }) }}
            </div>
          </div>
          <UBadge
            :color="DERIVED_STATE_COLORS[deriveFor(r)]"
            variant="subtle"
            :label="t(`rollStatus.${deriveFor(r)}`)"
          />
        </div>
      </NuxtLink>
    </div>

    <UCard v-else>
      <div class="text-center py-6 text-muted">{{ t('rolls.noneMatchFilter') }}</div>
    </UCard>
  </div>
</template>
