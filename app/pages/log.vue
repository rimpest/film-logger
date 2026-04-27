<script setup lang="ts">
import type { Lens, Shot } from '~~/types/models'
import { visibleFStops } from '~~/shared/apertures'

const api = useApi()
const toast = useToast()
const route = useRoute()
const { t } = useI18n()
const { online, queue, enqueueShot, flush } = useOfflineQueue()

// Cache-first: even with no signal we render the loaded rolls / cameras / lenses
// from IndexedDB. This is the page that has to work offline.
const { data: rolls } = useCachedRolls('loaded')
const { data: cameras } = useCachedCameras()
const { data: allLenses, refresh: refreshLenses } = useCachedLenses()

// Pick a roll: ?roll= takes priority, else the most recently loaded.
const selectedRollId = ref<number | null>(Number(route.query.roll) || null)
watchEffect(() => {
  if (selectedRollId.value == null && rolls.value.length) {
    selectedRollId.value = rolls.value[0].id
  }
})
const selectedRoll = computed(() =>
  rolls.value.find(r => r.id === selectedRollId.value) ?? null,
)
const cameraId = computed(() => selectedRoll.value?.camera_id ?? null)

// Lens picker filters to lenses tagged for this camera. Online: uses the
// server-side camera_lenses join. Offline: falls back to "all lenses" since we
// don't mirror the join table to IndexedDB in MVP.
const lensesForCamera = ref<Lens[]>([])
async function reloadLensFilter() {
  if (!cameraId.value || !online.value) {
    lensesForCamera.value = []
    return
  }
  try {
    lensesForCamera.value = await $fetch<Lens[]>('/api/lenses', {
      query: { camera_id: cameraId.value },
    })
  } catch {
    lensesForCamera.value = []
  }
}
watch([cameraId, online], () => { void reloadLensFilter() }, { immediate: true })

const showAllLenses = ref(false)
const visibleLenses = computed(() => {
  if (showAllLenses.value || !lensesForCamera.value.length) return allLenses.value
  return lensesForCamera.value
})

// Frame sequencing: read this roll's shots so we can suggest the next frame
// number. Cache-first (IDB) so the suggestion is instant offline; server
// refresh keeps it correct if the user logged from another device or skipped
// visiting the roll detail page on the way back here.
const rollShots = ref<Shot[]>([])
async function reloadShots() {
  if (!selectedRollId.value) {
    rollShots.value = []
    return
  }
  if (import.meta.client) {
    rollShots.value = (await localStore.readShotsByRoll(selectedRollId.value)) as Shot[]
  }
  if (online.value) {
    try {
      const fresh = await $fetch<{ shots: Shot[] }>(`/api/rolls/${selectedRollId.value}`)
      rollShots.value = fresh.shots
      await localStore.replaceShotsForRoll(selectedRollId.value, fresh.shots)
    } catch { /* keep cached */ }
  }
}
watch(selectedRollId, () => { void reloadShots() }, { immediate: true })

const suggestedFrame = computed(() => {
  const max = rollShots.value.reduce(
    (m, s) => Math.max(m, s.frame_number ?? 0),
    0,
  )
  const cap = selectedRoll.value?.frame_count ?? 1000
  return Math.min(max + 1, cap)
})

// `frameNumber` follows the suggestion until the user types something. After
// a successful save we reset the override flag so the next suggestion is
// picked up cleanly.
const frameNumber = ref<number | null>(null)
const userOverroteFrame = ref(false)
watch(suggestedFrame, (n) => {
  if (!userOverroteFrame.value) frameNumber.value = n
}, { immediate: true })
watch(selectedRollId, () => {
  userOverroteFrame.value = false
})
function onFrameInput(v: number | null) {
  userOverroteFrame.value = true
  frameNumber.value = v
}

const frameDuplicate = computed(() => {
  if (frameNumber.value == null) return false
  return rollShots.value.some(s => s.frame_number === frameNumber.value)
})

// Form state
const lensId = ref<number | null>(null)

// Pre-select the lens used on the most recent shot of this roll. Film
// shooters typically run several frames with the same lens before swapping,
// so re-picking every time is needless friction. Per-roll (not global)
// because rolls live in cameras and a lens that fits one camera may not fit
// another.
const lastUsedLensId = computed<number | null>(() => {
  if (!rollShots.value.length) return null
  let latest: Shot | null = null
  for (const s of rollShots.value) {
    if (!latest || (s.taken_at ?? '').localeCompare(latest.taken_at ?? '') > 0) {
      latest = s
    }
  }
  return latest?.lens_id ?? null
})

// Switching rolls likely means switching cameras — the previous lens is
// stale. Clearing also lets the pre-fill watch re-fire for the new roll.
watch(selectedRollId, () => { lensId.value = null })

// Pre-fill, but only when the field is empty so a manual pick is never
// clobbered. If the suggested lens isn't in the camera-filtered list (e.g.
// it was never tagged for this camera), flip "show all" so the dropdown
// actually renders the chosen label.
watch([lastUsedLensId, allLenses, lensesForCamera], () => {
  if (lensId.value != null) return
  const id = lastUsedLensId.value
  if (id == null) return
  if (!allLenses.value.some(l => l.id === id)) return
  lensId.value = id
  if (lensesForCamera.value.length && !lensesForCamera.value.some(l => l.id === id)) {
    showAllLenses.value = true
  }
}, { immediate: true })

const aperture = ref<number | null>(null)
// Pre-select 1/60s — close to most handheld shutter speeds, so the user can
// just tweak from there instead of picking from scratch every shot.
const shutter = ref<string>('1/60')
const notes = ref('')
const locationText = ref('')
const lat = ref<number | null>(null)
const lng = ref<number | null>(null)
const accuracy = ref<number | null>(null)

const SHUTTERS = ['B', '30', '15', '8', '4', '2', '1', '1/2', '1/4', '1/8', '1/15', '1/30', '1/60', '1/125', '1/250', '1/500', '1/1000', '1/2000']

// Aperture buttons are filtered to what the selected lens can actually shoot.
// `selectedLens` looks the lens up in either the camera-tagged list or the
// full cache so the filter works regardless of which list the user picked from.
const selectedLens = computed<Lens | null>(() => {
  if (lensId.value == null) return null
  const fromCamera = lensesForCamera.value.find(l => l.id === lensId.value)
  if (fromCamera) return fromCamera
  return allLenses.value.find(l => l.id === lensId.value) ?? null
})
const showAllApertures = ref(false)
const apertureChoices = computed(() => visibleFStops({
  maxAperture: selectedLens.value?.max_aperture ?? null,
  minAperture: selectedLens.value?.min_aperture ?? null,
  showUncommon: showAllApertures.value,
}))

const geo = useGeolocation()
async function captureLocation() {
  const loc = await geo.getCurrent()
  if (loc) {
    lat.value = loc.latitude
    lng.value = loc.longitude
    accuracy.value = loc.accuracy_m
    toast.add({ title: t('log.locationCapturedToast'), color: 'success' })
    return
  }
  // Failure paths each get their own message so the user understands whether
  // it's a permission problem (action required) or a browser/network problem
  // (use the map picker instead).
  const code = geo.errorCode.value
  const titleKey =
    code === 'permission_denied' ? 'log.locationPermissionDenied'
    : code === 'position_unavailable' ? 'log.locationUnavailable'
    : code === 'timeout' ? 'log.locationTimeout'
    : 'log.locationCouldNotGet'
  toast.add({ title: t(titleKey), color: 'error' })
}

// Map picker (OSM tiles via Leaflet) — fallback when device geolocation is
// broken (e.g. Chromium without a Google API key), or when the user just
// wants to drop a pin manually.
const showMapPicker = ref(false)
const pickedLocation = ref<{ latitude: number, longitude: number, accuracy_m: number | null } | null>(null)
function openMapPicker() {
  // Seed the picker with whatever coords we already have so the map opens
  // centered on the previous pin instead of world view.
  pickedLocation.value = lat.value != null && lng.value != null
    ? { latitude: lat.value, longitude: lng.value, accuracy_m: accuracy.value }
    : null
  showMapPicker.value = true
}
function confirmMapPick() {
  if (pickedLocation.value) {
    lat.value = pickedLocation.value.latitude
    lng.value = pickedLocation.value.longitude
    accuracy.value = pickedLocation.value.accuracy_m
    toast.add({ title: t('log.locationCapturedToast'), color: 'success' })
  }
  showMapPicker.value = false
}

// Quick-add lens, scoped to this page so users with an empty dropdown have an
// in-place escape hatch instead of bouncing to /lenses. The new lens is auto-
// tagged to the current roll's camera so the filtered dropdown picks it up.
const showAddLens = ref(false)
const newLens = reactive({
  name: '',
  focal_length_mm: 50 as number | null,
  max_aperture: null as number | null,
  mount: '',
})
function openAddLens() {
  newLens.name = ''
  newLens.focal_length_mm = 50
  newLens.max_aperture = null
  newLens.mount = ''
  showAddLens.value = true
}
const savingLens = ref(false)
async function saveNewLens() {
  if (!newLens.name?.trim() || !newLens.focal_length_mm) return
  savingLens.value = true
  try {
    const payload = {
      client_id: crypto.randomUUID(),
      name: newLens.name.trim(),
      focal_length_mm: newLens.focal_length_mm,
      max_aperture: newLens.max_aperture ?? null,
      min_aperture: null,
      mount: newLens.mount?.trim() || null,
      notes_encrypted: null,
      camera_ids: cameraId.value ? [cameraId.value] : [],
    }
    const { id } = await api.post<{ id: number }>('/api/lenses', payload)
    await Promise.all([refreshLenses(), reloadLensFilter()])
    lensId.value = id
    showAddLens.value = false
    toast.add({ title: t('log.lensAdded'), color: 'success' })
  } catch {
    toast.add({ title: t('errors.requestFailed'), color: 'error' })
  } finally {
    savingLens.value = false
  }
}

const submitting = ref(false)

async function submit() {
  if (!selectedRollId.value) {
    toast.add({ title: t('log.pickRollFirst'), color: 'error' })
    return
  }
  // Encrypt every sensitive field before it leaves the browser. The server
  // only ever sees the ciphertext blobs, so a DB dump exposes nothing.
  const key = await loadKey()
  if (!key) {
    toast.add({ title: t('errors.requestFailed'), color: 'error' })
    await navigateTo('/login?next=' + encodeURIComponent('/log'))
    return
  }
  submitting.value = true
  try {
    const hasLocation =
      lat.value != null || lng.value != null || locationText.value
    const locationPlain = hasLocation
      ? {
          text: locationText.value || null,
          latitude: lat.value,
          longitude: lng.value,
          accuracy_m: accuracy.value,
        }
      : null
    const payload = {
      client_id: crypto.randomUUID(),
      roll_id: selectedRollId.value,
      frame_number: frameNumber.value,
      taken_at: new Date().toISOString(),
      lens_id: lensId.value,
      aperture: aperture.value,
      shutter_speed: shutter.value || null,
      location_encrypted: locationPlain ? await encryptJson(key, locationPlain) : null,
      notes_encrypted: notes.value ? await encryptString(key, notes.value) : null,
    }
    if (online.value) {
      try {
        await api.post('/api/shots', payload)
        toast.add({ title: t('log.saved'), color: 'success' })
      } catch {
        // Network failed mid-request: queue and continue.
        enqueueShot(payload)
        toast.add({ title: t('log.savedLocally'), color: 'warning' })
      }
    } else {
      enqueueShot(payload)
      toast.add({ title: t('log.savedLocally'), color: 'warning' })
    }

    // Reset transient fields, keep the camera/lens/aperture as sane defaults for the next frame.
    notes.value = ''
    locationText.value = ''
    lat.value = null
    lng.value = null
    accuracy.value = null
    // Drop the override so the next visit picks up the new max from IDB.
    userOverroteFrame.value = false

    await navigateTo(`/rolls/${selectedRollId.value}`)
  } finally {
    submitting.value = false
  }
}

const cameraNameById = computed(() => {
  const map = new Map<number, string>()
  for (const c of cameras.value ?? []) map.set(c.id, c.name)
  return map
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('log.title') }}</h1>
      <UBadge v-if="!online" color="warning" variant="subtle" :label="t('home.offline')" icon="i-lucide-wifi-off" />
      <UBadge v-else-if="queue.length" color="info" variant="subtle" :label="t('home.pendingSync', { count: queue.length }, queue.length)" />
    </header>

    <UCard v-if="!rolls?.length">
      <div class="text-center py-6">
        <p class="font-medium">{{ t('log.noLoadedRolls') }}</p>
        <p class="text-sm text-muted mb-3">{{ t('log.noLoadedRollsHelp') }}</p>
        <UButton to="/rolls/new" :label="t('log.loadARoll')" color="primary" />
      </div>
    </UCard>

    <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
      <UFormField :label="t('log.roll')">
        <USelect
          v-model="selectedRollId"
          :items="(rolls ?? []).map(r => ({
            label: `${r.film_stock} — ${cameraNameById.get(r.camera_id) ?? t('rollNew.camera')}`,
            value: r.id,
          }))"
          :placeholder="t('log.selectRoll')"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="t('log.frame')">
        <UInput
          :model-value="frameNumber"
          type="number"
          min="1"
          :max="selectedRoll?.frame_count ?? undefined"
          class="w-full"
          @update:model-value="(v: string | number | null) => onFrameInput(v === '' || v == null ? null : Number(v))"
        />
        <template #help>
          <span v-if="frameDuplicate" class="text-warning">
            {{ t('log.frameDuplicateWarning', { n: frameNumber }) }}
          </span>
          <span v-else-if="selectedRoll">
            {{ t('log.frameHint', { n: suggestedFrame, total: selectedRoll.frame_count }) }}
          </span>
        </template>
      </UFormField>

      <UFormField :label="t('log.lens')">
        <div class="flex flex-col gap-2">
          <div class="flex gap-2">
            <USelect
              v-model="lensId"
              :items="visibleLenses.map(l => ({
                label: `${l.focal_length_mm}mm — ${l.name}`,
                value: l.id,
              }))"
              :placeholder="visibleLenses.length ? t('log.selectLens') : t('log.noLensesYet')"
              :disabled="!visibleLenses.length"
              class="flex-1"
            />
            <UButton
              type="button"
              icon="i-lucide-plus"
              :title="t('log.addLens')"
              :aria-label="t('log.addLens')"
              variant="outline"
              @click="openAddLens"
            />
          </div>
          <UCheckbox
            v-if="lensesForCamera.length"
            v-model="showAllLenses"
            :label="t('log.showAllLenses')"
          />
          <p v-if="!visibleLenses.length" class="text-xs text-muted">
            {{ t('log.noLensesHint') }}
          </p>
        </div>
      </UFormField>

      <UCard v-if="showAddLens">
        <template #header>
          <div class="text-sm font-medium">{{ t('log.lensQuickCreate') }}</div>
        </template>
        <div class="flex flex-col gap-3">
          <UFormField :label="t('lenses.name')" required>
            <UInput
              v-model="newLens.name"
              :placeholder="t('lenses.namePlaceholder')"
              class="w-full"
              autofocus
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="t('lenses.focalLengthMm')" required>
              <UInput v-model.number="newLens.focal_length_mm" type="number" min="1" />
            </UFormField>
            <UFormField :label="t('lenses.maxAperture')">
              <UInput v-model.number="newLens.max_aperture" type="number" step="0.1" />
            </UFormField>
          </div>
          <UFormField :label="t('lenses.mount')">
            <UInput v-model="newLens.mount" :placeholder="t('lenses.mountPlaceholder')" class="w-full" />
          </UFormField>
          <div class="flex gap-2">
            <UButton
              type="button"
              color="primary"
              :loading="savingLens"
              :disabled="!newLens.name?.trim() || !newLens.focal_length_mm"
              :label="t('common.save')"
              @click="saveNewLens"
            />
            <UButton
              type="button"
              variant="outline"
              :label="t('common.cancel')"
              @click="showAddLens = false"
            />
          </div>
        </div>
      </UCard>

      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('log.aperture')">
          <div class="flex flex-wrap gap-1">
            <UButton
              v-for="a in apertureChoices"
              :key="a.value"
              :label="`f/${a.label}`"
              size="xs"
              :variant="aperture === a.value ? 'solid' : 'outline'"
              @click="aperture = a.value"
            />
          </div>
          <UCheckbox
            v-model="showAllApertures"
            :label="t('log.showAllApertures')"
            class="mt-2"
          />
          <UInput
            v-model.number="aperture"
            type="number"
            step="0.1"
            :placeholder="t('log.apertureCustom')"
            class="mt-2"
          />
        </UFormField>
        <UFormField :label="t('log.shutterSpeed')">
          <USelect
            v-model="shutter"
            :items="SHUTTERS.map(s => ({ label: s, value: s }))"
            :placeholder="t('log.shutterSelect')"
            class="w-full"
          />
          <UInput
            v-model="shutter"
            :placeholder="t('log.shutterCustom')"
            class="mt-2"
          />
        </UFormField>
      </div>

      <UFormField :label="t('log.location')">
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap gap-2">
            <UButton
              type="button"
              icon="i-lucide-map-pin"
              :loading="geo.loading.value"
              :label="lat != null
                ? t('log.locationCaptured', { accuracy: accuracy != null ? accuracy.toFixed(0) : '?' })
                : t('log.useMyLocation')"
              variant="outline"
              @click="captureLocation"
            />
            <UButton
              type="button"
              icon="i-lucide-map"
              :label="t('log.pickOnMap')"
              variant="outline"
              :disabled="!online"
              @click="openMapPicker"
            />
          </div>
          <p v-if="!online" class="text-xs text-muted">
            {{ t('log.mapNeedsInternet') }}
          </p>
          <UInput
            v-model="locationText"
            :placeholder="t('log.locationTextPlaceholder')"
          />
        </div>
      </UFormField>

      <UModal v-model:open="showMapPicker" :title="t('log.pickOnMap')" :ui="{ content: 'sm:max-w-2xl' }">
        <template #body>
          <ClientOnly>
            <MapPicker
              v-model="pickedLocation"
              :current-location="lat != null && lng != null
                ? { latitude: lat, longitude: lng, accuracy_m: accuracy }
                : null"
              :attribution="t('log.mapAttribution')"
            />
          </ClientOnly>
        </template>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              type="button"
              variant="outline"
              :label="t('common.cancel')"
              @click="showMapPicker = false"
            />
            <UButton
              type="button"
              color="primary"
              :disabled="!pickedLocation"
              :label="t('log.useThisSpot')"
              @click="confirmMapPick"
            />
          </div>
        </template>
      </UModal>

      <UFormField :label="t('log.notes')">
        <UTextarea
          v-model="notes"
          :rows="3"
          :placeholder="t('log.notesPlaceholder')"
          class="w-full"
        />
      </UFormField>

      <UButton
        type="submit"
        :loading="submitting"
        block
        size="lg"
        :label="t('log.save')"
        icon="i-lucide-check"
      />
    </form>
  </div>
</template>
