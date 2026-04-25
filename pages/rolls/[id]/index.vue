<script setup lang="ts">
import type { Development, RollDetailRoll, Shot } from '~~/types/models'
import { deriveRollState, DERIVED_STATE_LABELS, DERIVED_STATE_COLORS } from '~~/shared/roll-status'

const route = useRoute()
const api = useApi()
const id = Number(route.params.id)

interface Detail {
  roll: RollDetailRoll
  shots: Shot[]
  developments: Development[]
}

const { data, refresh } = await useFetch<Detail>(`/api/rolls/${id}`, { default: () => null })

const derived = computed(() => {
  if (!data.value?.roll) return 'loaded' as const
  const latest = data.value.developments[0]
  return deriveRollState({
    status: data.value.roll.status,
    latest_development_status: latest?.status ?? null,
  })
})

async function markFinished() {
  await api.patch(`/api/rolls/${id}`, { status: 'finished' })
  await refresh()
}

async function archive() {
  if (!confirm('Archive this roll?')) return
  await api.patch(`/api/rolls/${id}`, { status: 'archived' })
  await refresh()
}

async function reopen() {
  await api.patch(`/api/rolls/${id}`, { status: 'loaded' })
  await refresh()
}

async function deleteShot(shotId: number) {
  if (!confirm('Delete this shot?')) return
  await api.del(`/api/shots/${shotId}`)
  await refresh()
}

async function markDelivered(devId: number) {
  await api.patch(`/api/developments/${devId}`, { status: 'delivered' })
  await refresh()
}
</script>

<template>
  <div v-if="data" class="flex flex-col gap-6">
    <header class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold truncate">{{ data.roll.film_stock }}</h1>
          <p class="text-sm text-muted truncate">
            {{ data.roll.camera_name }} · ISO {{ data.roll.iso }} · {{ data.shots.length }} / {{ data.roll.frame_count }} shots
          </p>
        </div>
        <UBadge
          :color="DERIVED_STATE_COLORS[derived]"
          variant="subtle"
          :label="DERIVED_STATE_LABELS[derived]"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="data.roll.status === 'loaded'"
          :to="`/log?roll=${data.roll.id}`"
          icon="i-lucide-plus"
          label="Log a shot"
          color="primary"
        />
        <UButton
          v-if="data.roll.status === 'loaded'"
          icon="i-lucide-check"
          label="Mark finished"
          variant="outline"
          @click="markFinished"
        />
        <UButton
          v-if="data.roll.status === 'finished'"
          :to="`/rolls/${id}/send`"
          icon="i-lucide-send"
          label="Send to lab"
          color="primary"
        />
        <UButton
          v-if="data.roll.status === 'finished'"
          icon="i-lucide-undo-2"
          variant="outline"
          label="Re-open"
          @click="reopen"
        />
        <UButton
          v-if="data.roll.status !== 'archived'"
          icon="i-lucide-archive"
          variant="ghost"
          color="neutral"
          label="Archive"
          @click="archive"
        />
      </div>
    </header>

    <section>
      <h2 class="text-sm font-medium text-muted uppercase tracking-wide mb-2">Shots</h2>
      <div v-if="data.shots.length" class="flex flex-col gap-2">
        <div
          v-for="s in data.shots"
          :key="s.id"
          class="rounded-lg border border-default bg-elevated/40 p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-baseline gap-2 flex-wrap">
                <span class="font-mono text-xs text-muted">
                  #{{ s.frame_number ?? '—' }}
                </span>
                <span class="text-sm">
                  {{ new Date(s.taken_at).toLocaleString() }}
                </span>
              </div>
              <div class="text-sm mt-1">
                <span v-if="s.lens_name">{{ s.lens_name }}</span>
                <span v-if="s.aperture"> · f/{{ s.aperture }}</span>
                <span v-if="s.shutter_speed"> · {{ s.shutter_speed }}s</span>
              </div>
              <div v-if="s.location_text || s.latitude" class="text-xs text-muted mt-1 flex items-center gap-1">
                <UIcon name="i-lucide-map-pin" class="size-3" />
                <span v-if="s.location_text">{{ s.location_text }}</span>
                <span v-else>{{ s.latitude!.toFixed(4) }}, {{ s.longitude!.toFixed(4) }}</span>
              </div>
              <div v-if="s.notes" class="text-sm text-muted mt-1">{{ s.notes }}</div>
            </div>
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="xs"
              @click="deleteShot(s.id)"
            />
          </div>
        </div>
      </div>
      <UCard v-else>
        <div class="text-center text-sm text-muted py-4">No shots logged yet.</div>
      </UCard>
    </section>

    <section>
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-medium text-muted uppercase tracking-wide">Development history</h2>
        <UButton
          v-if="data.roll.status !== 'loaded'"
          :to="`/rolls/${id}/send`"
          icon="i-lucide-plus"
          variant="ghost"
          size="xs"
          label="Add"
        />
      </div>
      <div v-if="data.developments.length" class="flex flex-col gap-2">
        <div
          v-for="d in data.developments"
          :key="d.id"
          class="rounded-lg border border-default bg-elevated/40 p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-medium">
                {{ d.lab_name ?? 'Self-developed' }}
              </div>
              <div class="text-sm text-muted">
                {{ d.status }}
                <span v-if="d.process"> · {{ d.process }}</span>
                <span v-if="d.push_pull_stops">
                  · {{ d.push_pull_stops > 0 ? `+${d.push_pull_stops}` : d.push_pull_stops }} stop{{ Math.abs(d.push_pull_stops) === 1 ? '' : 's' }}
                </span>
              </div>
              <div class="text-xs text-muted mt-1">
                <span v-if="d.dropped_off_at">Dropped off {{ new Date(d.dropped_off_at).toLocaleDateString() }}</span>
                <span v-if="d.delivered_at"> · Delivered {{ new Date(d.delivered_at).toLocaleDateString() }}</span>
              </div>
              <div v-if="d.cost != null" class="text-xs text-muted mt-1">
                {{ d.cost }} {{ d.currency ?? '' }}
              </div>
              <div v-if="d.notes" class="text-sm text-muted mt-1">{{ d.notes }}</div>
            </div>
            <UButton
              v-if="d.status === 'dropped_off' || d.status === 'in_progress'"
              icon="i-lucide-check"
              size="xs"
              variant="outline"
              label="Mark delivered"
              @click="markDelivered(d.id)"
            />
          </div>
        </div>
      </div>
      <UCard v-else>
        <div class="text-center text-sm text-muted py-4">
          No development records yet.
        </div>
      </UCard>
    </section>
  </div>
</template>
