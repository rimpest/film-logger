<script setup lang="ts">
import type { Lens } from '~~/types/models'

const api = useApi()
const toast = useToast()
const route = useRoute()
const { t } = useI18n()
const { online, queue, enqueueShot, flush } = useOfflineQueue()

// Cache-first: even with no signal we render the loaded rolls / cameras / lenses
// from IndexedDB. This is the page that has to work offline.
const { data: rolls } = useCachedRolls('loaded')
const { data: cameras } = useCachedCameras()
const { data: allLenses } = useCachedLenses()

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

// Form state
const lensId = ref<number | null>(null)
const aperture = ref<number | null>(null)
const shutter = ref<string>('')
const notes = ref('')
const locationText = ref('')
const lat = ref<number | null>(null)
const lng = ref<number | null>(null)
const accuracy = ref<number | null>(null)

const APERTURES = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22]
const SHUTTERS = ['B', '30', '15', '8', '4', '2', '1', '1/2', '1/4', '1/8', '1/15', '1/30', '1/60', '1/125', '1/250', '1/500', '1/1000', '1/2000']

const geo = useGeolocation()
async function captureLocation() {
  const loc = await geo.getCurrent()
  if (loc) {
    lat.value = loc.latitude
    lng.value = loc.longitude
    accuracy.value = loc.accuracy_m
    toast.add({ title: t('log.locationCapturedToast'), color: 'success' })
  } else if (geo.error.value) {
    toast.add({ title: t('log.locationCouldNotGet'), color: 'error' })
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

      <UFormField :label="t('log.lens')">
        <div class="flex flex-col gap-2">
          <USelect
            v-model="lensId"
            :items="visibleLenses.map(l => ({
              label: `${l.focal_length_mm}mm — ${l.name}`,
              value: l.id,
            }))"
            :placeholder="t('log.selectLens')"
            class="w-full"
          />
          <UCheckbox
            v-if="lensesForCamera.length"
            v-model="showAllLenses"
            :label="t('log.showAllLenses')"
          />
        </div>
      </UFormField>

      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('log.aperture')">
          <div class="flex flex-wrap gap-1">
            <UButton
              v-for="a in APERTURES"
              :key="a"
              :label="`f/${a}`"
              size="xs"
              :variant="aperture === a ? 'solid' : 'outline'"
              @click="aperture = a"
            />
          </div>
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
          <UButton
            type="button"
            icon="i-lucide-map-pin"
            :loading="geo.loading.value"
            :label="lat != null
              ? t('log.locationCaptured', { accuracy: accuracy ? accuracy.toFixed(0) : '?' })
              : t('log.useMyLocation')"
            variant="outline"
            @click="captureLocation"
          />
          <UInput
            v-model="locationText"
            :placeholder="t('log.locationTextPlaceholder')"
          />
        </div>
      </UFormField>

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
