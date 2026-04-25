<script setup lang="ts">
import { deriveRollState, DERIVED_STATE_LABELS, DERIVED_STATE_COLORS } from '~~/shared/roll-status'
import type { Development } from '~~/types/models'

const route = useRoute()
const api = useApi()
const id = Number(route.params.id)

// Cache-first roll detail. The shots ref includes any offline-queued shots
// (`_pending: true`) so the user sees them immediately after logging.
const { roll, shots, developments, refresh } = useCachedRollDetail(id)

const derived = computed(() => {
  if (!roll.value) return 'loaded' as const
  const latest = developments.value[0] as { status?: string } | undefined
  return deriveRollState({
    status: roll.value.status,
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

const devs = computed(() => developments.value as Development[])
</script>

<template>
  <div v-if="roll" class="flex flex-col gap-6">
    <header class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold truncate">{{ roll.film_stock }}</h1>
          <p class="text-sm text-muted truncate">
            {{ (roll as any).camera_name }} · ISO {{ roll.iso }} · {{ shots.length }} / {{ roll.frame_count }} shots
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
          v-if="roll.status === 'loaded'"
          :to="`/log?roll=${roll.id}`"
          icon="i-lucide-plus"
          label="Log a shot"
          color="primary"
        />
        <UButton
          v-if="roll.status === 'loaded'"
          icon="i-lucide-check"
          label="Mark finished"
          variant="outline"
          @click="markFinished"
        />
        <UButton
          v-if="roll.status === 'finished'"
          :to="`/rolls/${id}/send`"
          icon="i-lucide-send"
          label="Send to lab"
          color="primary"
        />
        <UButton
          v-if="roll.status === 'finished'"
          icon="i-lucide-undo-2"
          variant="outline"
          label="Re-open"
          @click="reopen"
        />
        <UButton
          v-if="roll.status !== 'archived'"
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
      <div v-if="shots.length" class="flex flex-col gap-2">
        <div
          v-for="s in shots"
          :key="s.id || s.client_id || s.taken_at"
          class="rounded-lg border p-3 transition"
          :class="(s as any)._pending
            ? 'border-warning/40 bg-warning/5'
            : 'border-default bg-elevated/40'"
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
                <UBadge
                  v-if="(s as any)._pending"
                  size="xs"
                  color="warning"
                  variant="subtle"
                  icon="i-lucide-cloud-upload"
                  label="Pending sync"
                />
              </div>
              <div class="text-sm mt-1">
                <span v-if="(s as any).lens_name">{{ (s as any).lens_name }}</span>
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
              v-if="!(s as any)._pending"
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
          v-if="roll.status !== 'loaded'"
          :to="`/rolls/${id}/send`"
          icon="i-lucide-plus"
          variant="ghost"
          size="xs"
          label="Add"
        />
      </div>
      <div v-if="devs.length" class="flex flex-col gap-2">
        <div
          v-for="d in devs"
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
  <UCard v-else>
    <div class="text-center text-sm text-muted py-6">Loading…</div>
  </UCard>
</template>
