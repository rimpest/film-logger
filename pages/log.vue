<script setup lang="ts">
import type { Camera, Lens, RollListItem } from '~~/types/models'

const api = useApi()
const toast = useToast()
const route = useRoute()
const { online, queue, enqueueShot, flush } = useOfflineQueue()

const { data: rolls } = await useFetch<RollListItem[]>('/api/rolls', {
  query: { status: 'loaded' },
  default: () => [],
})
const { data: cameras } = await useFetch<Camera[]>('/api/cameras', { default: () => [] })
const { data: allLenses } = await useFetch<Lens[]>('/api/lenses', { default: () => [] })

// Pick a roll: ?roll= takes priority, else the most recently loaded.
const initialRollId = Number(route.query.roll) || rolls.value?.[0]?.id || null
const selectedRollId = ref<number | null>(initialRollId)
const selectedRoll = computed(() =>
  rolls.value?.find(r => r.id === selectedRollId.value) ?? null,
)
const cameraId = computed(() => selectedRoll.value?.camera_id ?? null)

// Lens picker filters to lenses tagged for this camera, falling back to all.
const lensesForCamera = ref<Lens[]>([])
async function reloadLensFilter() {
  if (!cameraId.value) {
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
watch(cameraId, () => { void reloadLensFilter() }, { immediate: true })

const showAllLenses = ref(false)
const visibleLenses = computed(() => {
  if (showAllLenses.value || !lensesForCamera.value.length) return allLenses.value ?? []
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
    toast.add({ title: 'Location captured', color: 'success' })
  } else if (geo.error.value) {
    toast.add({ title: geo.error.value, color: 'error' })
  }
}

const submitting = ref(false)

async function submit() {
  if (!selectedRollId.value) {
    toast.add({ title: 'Pick a roll first', color: 'error' })
    return
  }
  submitting.value = true
  try {
    const payload = {
      client_id: crypto.randomUUID(),
      roll_id: selectedRollId.value,
      taken_at: new Date().toISOString(),
      lens_id: lensId.value,
      aperture: aperture.value,
      shutter_speed: shutter.value || null,
      location_text: locationText.value || null,
      latitude: lat.value,
      longitude: lng.value,
      location_accuracy_m: accuracy.value,
      notes: notes.value || null,
    }
    if (online.value) {
      try {
        await api.post('/api/shots', payload)
        toast.add({ title: 'Shot logged', color: 'success' })
      } catch {
        // Network failed mid-request: queue and continue.
        enqueueShot(payload)
        toast.add({ title: 'Saved locally — will sync', color: 'warning' })
      }
    } else {
      enqueueShot(payload)
      toast.add({ title: 'Saved locally — will sync', color: 'warning' })
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
      <h1 class="text-xl font-semibold">Log a shot</h1>
      <UBadge v-if="!online" color="warning" variant="subtle" label="Offline" icon="i-lucide-wifi-off" />
      <UBadge v-else-if="queue.length" color="info" variant="subtle" :label="`${queue.length} pending`" />
    </header>

    <UCard v-if="!rolls?.length">
      <div class="text-center py-6">
        <p class="font-medium">No loaded rolls.</p>
        <p class="text-sm text-muted mb-3">Load a roll into one of your cameras first.</p>
        <UButton to="/rolls/new" label="Load a roll" color="primary" />
      </div>
    </UCard>

    <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
      <UFormField label="Roll">
        <USelect
          v-model="selectedRollId"
          :items="(rolls ?? []).map(r => ({
            label: `${r.film_stock} — ${cameraNameById.get(r.camera_id) ?? 'Camera'}`,
            value: r.id,
          }))"
          placeholder="Select a roll"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Lens">
        <div class="flex flex-col gap-2">
          <USelect
            v-model="lensId"
            :items="visibleLenses.map(l => ({
              label: `${l.focal_length_mm}mm — ${l.name}`,
              value: l.id,
            }))"
            placeholder="Select a lens"
            class="w-full"
          />
          <UCheckbox
            v-if="lensesForCamera.length"
            v-model="showAllLenses"
            label="Show all lenses (not just tagged for this camera)"
          />
        </div>
      </UFormField>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Aperture (f/)">
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
            placeholder="Custom"
            class="mt-2"
          />
        </UFormField>
        <UFormField label="Shutter speed">
          <USelect
            v-model="shutter"
            :items="SHUTTERS.map(s => ({ label: s, value: s }))"
            placeholder="Select"
            class="w-full"
          />
          <UInput
            v-model="shutter"
            placeholder="Custom (e.g. 1/45)"
            class="mt-2"
          />
        </UFormField>
      </div>

      <UFormField label="Location">
        <div class="flex flex-col gap-2">
          <UButton
            type="button"
            icon="i-lucide-map-pin"
            :loading="geo.loading.value"
            :label="lat != null ? `Captured (±${accuracy ? accuracy.toFixed(0) : '?'}m)` : 'Use my location'"
            variant="outline"
            @click="captureLocation"
          />
          <UInput
            v-model="locationText"
            placeholder="Or type a place name"
          />
        </div>
      </UFormField>

      <UFormField label="Notes">
        <UTextarea
          v-model="notes"
          :rows="3"
          placeholder="Subject, light, what you were after..."
          class="w-full"
        />
      </UFormField>

      <UButton
        type="submit"
        :loading="submitting"
        block
        size="lg"
        label="Save shot"
        icon="i-lucide-check"
      />
    </form>
  </div>
</template>
