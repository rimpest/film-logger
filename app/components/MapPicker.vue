<script setup lang="ts">
/**
 * Tap-to-pin map picker on OpenStreetMap tiles via Leaflet.
 *
 * No Google, no API key, no tracking pixels. Loaded only when the modal
 * opens because Leaflet touches `window` on import — the component renders
 * a placeholder div on SSR and dynamic-imports the library inside
 * `onMounted`, so it stays out of the main bundle and never runs server-side.
 *
 * Three things on the map:
 *   - Search box (top): typed query → /api/geocode (Nominatim proxy) →
 *     pickable result list.
 *   - "You are here" dot: a non-interactive blue circle at `currentLocation`
 *     (the coords already captured into the form), so even after dragging
 *     the pin the user sees their starting reference.
 *   - Pick marker: draggable; clicking the map moves it. Its coords are
 *     what `v-model` emits.
 *
 * Tile attribution is required by the OSM tile usage policy.
 */
import 'leaflet/dist/leaflet.css'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png?url'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png?url'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png?url'
import type * as LeafletNS from 'leaflet'

export interface PickedLocation {
  latitude: number
  longitude: number
  accuracy_m: number | null
}

interface GeocodeResult {
  id: number
  name: string
  latitude: number
  longitude: number
}

const props = defineProps<{
  modelValue: PickedLocation | null
  /** Coords already captured into the form (e.g. by "Use my location"). Shown
   *  as a separate non-interactive dot so the user can see their reference
   *  point even after dragging the pin elsewhere. */
  currentLocation?: PickedLocation | null
  attribution?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PickedLocation]
}>()

const { t } = useI18n()

const mapEl = ref<HTMLDivElement | null>(null)
let map: LeafletNS.Map | null = null
let marker: LeafletNS.Marker | null = null
let currentDot: LeafletNS.CircleMarker | null = null
let placeOrMoveMarker: ((latlng: LeafletNS.LatLng) => void) | null = null
let flyTo: ((lat: number, lng: number, zoom?: number) => void) | null = null

// Search state
const searchQuery = ref('')
const searching = ref(false)
const searchedOnce = ref(false)
const results = ref<GeocodeResult[]>([])

async function runSearch() {
  const q = searchQuery.value.trim()
  if (q.length < 2) return
  searching.value = true
  searchedOnce.value = true
  try {
    results.value = await $fetch<GeocodeResult[]>('/api/geocode', { query: { q } })
  } catch {
    results.value = []
  } finally {
    searching.value = false
  }
}

function selectResult(r: GeocodeResult) {
  if (!flyTo || !placeOrMoveMarker) return
  flyTo(r.latitude, r.longitude, 14)
  // Build a Leaflet LatLng without needing the L namespace at this scope —
  // placeOrMoveMarker accepts the structural shape Leaflet's helpers expect.
  placeOrMoveMarker({ lat: r.latitude, lng: r.longitude } as LeafletNS.LatLng)
  results.value = []
  searchQuery.value = r.name
}

onMounted(async () => {
  if (!mapEl.value) return
  const L = await import('leaflet')

  L.Icon.Default.mergeOptions({
    iconUrl: markerIconUrl,
    iconRetinaUrl: markerIconRetinaUrl,
    shadowUrl: markerShadowUrl,
  })

  const start = props.modelValue ?? props.currentLocation ?? null
  const initialLat = start?.latitude ?? 20
  const initialLng = start?.longitude ?? 0
  const initialZoom = start ? 14 : 2

  map = L.map(mapEl.value).setView([initialLat, initialLng], initialZoom)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: props.attribution ?? '© OpenStreetMap contributors',
  }).addTo(map)

  flyTo = (lat, lng, zoom) => {
    if (!map) return
    map.flyTo([lat, lng], zoom ?? map.getZoom(), { animate: true, duration: 0.6 })
  }

  function pushUpdate(latlng: LeafletNS.LatLng) {
    emit('update:modelValue', {
      latitude: latlng.lat,
      longitude: latlng.lng,
      // Manual pick: precision is whatever the user thinks it is, not a
      // measured radius. Null distinguishes it from a sensor reading.
      accuracy_m: null,
    })
  }

  placeOrMoveMarker = (latlng: LeafletNS.LatLng) => {
    if (!map) return
    if (!marker) {
      marker = L.marker(latlng, { draggable: true }).addTo(map)
      marker.on('dragend', () => marker && pushUpdate(marker.getLatLng()))
    } else {
      marker.setLatLng(latlng)
    }
    pushUpdate(latlng)
  }

  // "You are here" dot for the user's already-captured coords. Stays put
  // even as the user drags the pick marker, so they keep a visual reference.
  if (props.currentLocation) {
    currentDot = L.circleMarker(
      [props.currentLocation.latitude, props.currentLocation.longitude],
      {
        radius: 7,
        color: '#3b82f6',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.4,
        interactive: false,
      },
    ).addTo(map)
    currentDot.bindTooltip(t('log.currentLocationTooltip'), { permanent: false })
  }

  if (props.modelValue) {
    placeOrMoveMarker(L.latLng(props.modelValue.latitude, props.modelValue.longitude))
  }

  map.on('click', (e: LeafletNS.LeafletMouseEvent) => placeOrMoveMarker?.(e.latlng))
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  marker = null
  currentDot = null
  placeOrMoveMarker = null
  flyTo = null
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex gap-2">
      <UInput
        v-model="searchQuery"
        :placeholder="t('log.searchPlaceholder')"
        icon="i-lucide-search"
        class="flex-1"
        @keydown.enter.prevent="runSearch"
      />
      <UButton
        type="button"
        :loading="searching"
        :label="t('log.searchPlaces')"
        variant="outline"
        @click="runSearch"
      />
    </div>
    <ul
      v-if="results.length"
      class="rounded-md border border-default divide-y divide-default text-sm max-h-40 overflow-auto"
    >
      <li
        v-for="r in results"
        :key="r.id"
        class="px-3 py-2 cursor-pointer hover:bg-elevated/50"
        @click="selectResult(r)"
      >
        {{ r.name }}
      </li>
    </ul>
    <p
      v-else-if="searchedOnce && !searching"
      class="text-xs text-muted"
    >
      {{ t('log.searchNoResults') }}
    </p>
    <div
      ref="mapEl"
      class="w-full h-80 rounded-md border border-default bg-elevated/40"
    />
    <p v-if="currentLocation" class="text-xs text-muted flex items-center gap-1">
      <span class="inline-block size-2 rounded-full bg-blue-500" />
      {{ t('log.currentLocationLegend') }}
    </p>
  </div>
</template>
