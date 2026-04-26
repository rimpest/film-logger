<script setup lang="ts">
import { deriveRollState, DERIVED_STATE_COLORS } from '~~/shared/roll-status'
import type { Development, ShotLocationPlain } from '~~/types/models'

const route = useRoute()
const api = useApi()
const id = Number(route.params.id)
const { t, locale } = useI18n()

// Lazy-decrypt notes/locations as we render. We keep a tiny in-memory cache
// keyed by ciphertext so re-renders don't re-decrypt the same blob repeatedly.
const decryptCache = reactive(new Map<string, string>())
const locationCache = reactive(new Map<string, ShotLocationPlain>())
async function ensureDecrypted(blob: string | null | undefined) {
  if (!blob) return null
  if (decryptCache.has(blob)) return decryptCache.get(blob)!
  const key = await loadKey()
  if (!key) return null
  try {
    const text = await decryptText(key, blob)
    if (text != null) decryptCache.set(blob, text)
    return text
  } catch { return null }
}
async function ensureLocation(blob: string | null | undefined) {
  if (!blob) return null
  if (locationCache.has(blob)) return locationCache.get(blob)!
  const key = await loadKey()
  if (!key) return null
  try {
    const obj = await decryptJson<ShotLocationPlain>(key, blob)
    if (obj) locationCache.set(blob, obj)
    return obj
  } catch { return null }
}

// Cache-first roll detail. The shots ref includes any offline-queued shots
// (`_pending: true`) so the user sees them immediately after logging.
const { roll, shots, developments, refresh } = useCachedRollDetail(id)

const devs = computed(() => developments.value as Development[])

// As shots / devs come in, decrypt their notes & location blobs in the
// background and stash the plaintext into the reactive caches above. The
// template reads the caches via plain getters, so it stays synchronous.
watch([shots, devs], async ([sList, dList]) => {
  await Promise.all([
    ...sList.map(s => ensureDecrypted((s as any).notes_encrypted)),
    ...sList.map(s => ensureLocation((s as any).location_encrypted)),
    ...(dList ?? []).map(d => ensureDecrypted(d.notes_encrypted)),
  ])
}, { immediate: true })

function notesOf(row: { notes_encrypted: string | null }): string | null {
  return row.notes_encrypted ? (decryptCache.get(row.notes_encrypted) ?? null) : null
}
function locationOf(s: { location_encrypted: string | null }): ShotLocationPlain | null {
  return s.location_encrypted ? (locationCache.get(s.location_encrypted) ?? null) : null
}

// Derived state needs `latest_development_lab_id` to distinguish self-dev
// ("Developing") from at-lab. We pull both from the latest development row.
const derived = computed(() => {
  if (!roll.value) return 'loaded' as const
  const latest = devs.value[0]
  return deriveRollState({
    status: roll.value.status,
    latest_development_status: latest?.status ?? null,
    latest_development_lab_id: latest ? latest.lab_id : undefined,
  })
})

async function markFinished() {
  await api.patch(`/api/rolls/${id}`, { status: 'finished' })
  await refresh()
}

async function archive() {
  if (!confirm(t('rollDetail.archiveConfirm'))) return
  await api.patch(`/api/rolls/${id}`, { status: 'archived' })
  await refresh()
}

async function reopen() {
  await api.patch(`/api/rolls/${id}`, { status: 'loaded' })
  await refresh()
}

async function deleteShot(shotId: number) {
  if (!confirm(t('rollDetail.deleteShot'))) return
  await api.del(`/api/shots/${shotId}`)
  await refresh()
}

async function markDelivered(devId: number) {
  await api.patch(`/api/developments/${devId}`, { status: 'delivered' })
  await refresh()
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(locale.value)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value)
}
</script>

<template>
  <div v-if="roll" class="flex flex-col gap-6">
    <header class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold truncate">{{ roll.film_stock }}</h1>
          <p class="text-sm text-muted truncate">
            {{ (roll as any).camera_name }} · ISO {{ roll.iso }} · {{ shots.length }} / {{ roll.frame_count }} {{ t('home.shotsShort') }}
          </p>
        </div>
        <UBadge
          :color="DERIVED_STATE_COLORS[derived]"
          variant="subtle"
          :label="t(`rollStatus.${derived}`)"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="roll.status === 'loaded'"
          :to="`/log?roll=${roll.id}`"
          icon="i-lucide-plus"
          :label="t('rollDetail.logShot')"
          color="primary"
        />
        <UButton
          v-if="roll.status === 'loaded'"
          icon="i-lucide-check"
          :label="t('rollDetail.markFinished')"
          variant="outline"
          @click="markFinished"
        />
        <UButton
          v-if="roll.status === 'finished'"
          :to="`/rolls/${id}/send`"
          icon="i-lucide-send"
          :label="t('rollDetail.sendToLab')"
          color="primary"
        />
        <UButton
          v-if="roll.status === 'finished'"
          icon="i-lucide-undo-2"
          variant="outline"
          :label="t('rollDetail.reopen')"
          @click="reopen"
        />
        <UButton
          v-if="roll.status !== 'archived'"
          icon="i-lucide-archive"
          variant="ghost"
          color="neutral"
          :label="t('rollDetail.archive')"
          @click="archive"
        />
      </div>
    </header>

    <section>
      <h2 class="text-sm font-medium text-muted uppercase tracking-wide mb-2">{{ t('rollDetail.shots') }}</h2>
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
                  {{ t('rollDetail.frameMarker', { n: s.frame_number ?? '—' }) }}
                </span>
                <span class="text-sm">
                  {{ fmtDateTime(s.taken_at) }}
                </span>
                <UBadge
                  v-if="(s as any)._pending"
                  size="xs"
                  color="warning"
                  variant="subtle"
                  icon="i-lucide-cloud-upload"
                  :label="t('rollDetail.pendingSync')"
                />
              </div>
              <div class="text-sm mt-1">
                <span v-if="(s as any).lens_name">{{ (s as any).lens_name }}</span>
                <span v-if="s.aperture"> · f/{{ s.aperture }}</span>
                <span v-if="s.shutter_speed"> · {{ s.shutter_speed }}s</span>
              </div>
              <template v-if="locationOf(s as any)">
                <div class="text-xs text-muted mt-1 flex items-center gap-1">
                  <UIcon name="i-lucide-map-pin" class="size-3" />
                  <span v-if="locationOf(s as any)?.text">{{ locationOf(s as any)?.text }}</span>
                  <span v-else-if="locationOf(s as any)?.latitude != null">
                    {{ locationOf(s as any)!.latitude!.toFixed(4) }}, {{ locationOf(s as any)!.longitude!.toFixed(4) }}
                  </span>
                </div>
              </template>
              <div v-if="notesOf(s as any)" class="text-sm text-muted mt-1">{{ notesOf(s as any) }}</div>
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
        <div class="text-center text-sm text-muted py-4">{{ t('rollDetail.noShots') }}</div>
      </UCard>
    </section>

    <section>
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-medium text-muted uppercase tracking-wide">{{ t('rollDetail.developmentHistory') }}</h2>
        <UButton
          v-if="roll.status !== 'loaded'"
          :to="`/rolls/${id}/send`"
          icon="i-lucide-plus"
          variant="ghost"
          size="xs"
          :label="t('rollDetail.addDevelopment')"
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
                {{ d.lab_name ?? t('rollDetail.selfDeveloped') }}
              </div>
              <div class="text-sm text-muted">
                {{ t(`devStatus.${d.status}`) }}
                <span v-if="d.process"> · {{ d.process }}</span>
                <span v-if="d.push_pull_stops">
                  · {{ d.push_pull_stops > 0 ? `+${d.push_pull_stops}` : d.push_pull_stops }} {{ t('rollDetail.stops', Math.abs(d.push_pull_stops)) }}
                </span>
              </div>
              <div class="text-xs text-muted mt-1">
                <span v-if="d.dropped_off_at">{{ t('rollDetail.droppedOffOn', { date: fmtDate(d.dropped_off_at) }) }}</span>
                <span v-if="d.delivered_at"> · {{ t('rollDetail.deliveredOn', { date: fmtDate(d.delivered_at) }) }}</span>
              </div>
              <div v-if="d.cost != null" class="text-xs text-muted mt-1">
                {{ d.cost }} {{ d.currency ?? '' }}
              </div>
              <div v-if="notesOf(d)" class="text-sm text-muted mt-1">{{ notesOf(d) }}</div>
            </div>
            <UButton
              v-if="d.status === 'dropped_off' || d.status === 'in_progress'"
              icon="i-lucide-check"
              size="xs"
              variant="outline"
              :label="t('rollDetail.markDelivered')"
              @click="markDelivered(d.id)"
            />
          </div>
        </div>
      </div>
      <UCard v-else>
        <div class="text-center text-sm text-muted py-4">
          {{ t('rollDetail.noDevelopments') }}
        </div>
      </UCard>
    </section>
  </div>
  <UCard v-else>
    <div class="text-center text-sm text-muted py-6">{{ t('rollDetail.loading') }}</div>
  </UCard>
</template>
