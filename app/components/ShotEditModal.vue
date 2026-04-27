<script setup lang="ts">
/**
 * Edit-shot modal. Presented from the roll detail review list when the user
 * clicks the pencil icon on a shot card.
 *
 * Mirrors the field set of the log form (frame number, lens, aperture,
 * shutter, location with optional map pin, notes), then re-encrypts the
 * sensitive fields client-side before PATCHing /api/shots/:id. The server
 * never sees plaintext notes or coordinates.
 *
 * Delete lives inside this modal (not on the card) because edit is now the
 * primary action — most "I want to fix this shot" flows are about adjusting
 * data, not removing it. Hard-delete is one click further to keep accidents
 * down.
 */
import type { Lens, Shot, ShotLocationPlain } from '~~/types/models'
import { visibleFStops } from '~~/shared/apertures'

const props = defineProps<{
  open: boolean
  shot: Shot | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
  deleted: []
}>()

const api = useApi()
const toast = useToast()
const { t } = useI18n()
const { data: allLenses } = useCachedLenses()

const frameNumber = ref<number | null>(null)
const lensId = ref<number | null>(null)
const aperture = ref<number | null>(null)
const shutter = ref<string>('')
const notes = ref('')
const locationText = ref('')
const lat = ref<number | null>(null)
const lng = ref<number | null>(null)
const accuracy = ref<number | null>(null)

const SHUTTERS = ['B', '30', '15', '8', '4', '2', '1', '1/2', '1/4', '1/8', '1/15', '1/30', '1/60', '1/125', '1/250', '1/500', '1/1000', '1/2000']

const selectedLens = computed<Lens | null>(() =>
  lensId.value == null
    ? null
    : (allLenses.value.find(l => l.id === lensId.value) ?? null),
)
const showAllApertures = ref(false)
const apertureChoices = computed(() => visibleFStops({
  maxAperture: selectedLens.value?.max_aperture ?? null,
  minAperture: selectedLens.value?.min_aperture ?? null,
  showUncommon: showAllApertures.value,
}))

// Hydrate the form whenever the modal is opened on a shot. We re-decrypt
// every time so a stale plaintext from a previous open never leaks.
const hydrating = ref(false)
watch(() => [props.open, props.shot?.id] as const, async ([open]) => {
  if (!open || !props.shot) return
  hydrating.value = true
  try {
    const s = props.shot
    frameNumber.value = s.frame_number ?? null
    lensId.value = s.lens_id ?? null
    aperture.value = s.aperture ?? null
    shutter.value = s.shutter_speed ?? ''
    notes.value = ''
    locationText.value = ''
    lat.value = null
    lng.value = null
    accuracy.value = null
    const key = await loadKey()
    if (!key) return
    if (s.notes_encrypted) {
      try { notes.value = (await decryptText(key, s.notes_encrypted)) ?? '' }
      catch { /* ignore — leave empty */ }
    }
    if (s.location_encrypted) {
      try {
        const loc = await decryptJson<ShotLocationPlain>(key, s.location_encrypted)
        if (loc) {
          locationText.value = loc.text ?? ''
          lat.value = loc.latitude ?? null
          lng.value = loc.longitude ?? null
          accuracy.value = loc.accuracy_m ?? null
        }
      } catch { /* ignore */ }
    }
  } finally {
    hydrating.value = false
  }
}, { immediate: true })

// Inline map picker (no nested modal — keeps the z-index sane and avoids
// @nuxt/ui v4 modal-stacking quirks).
const showMapPicker = ref(false)
const pickedLocation = ref<{ latitude: number, longitude: number, accuracy_m: number | null } | null>(null)
function openMapPicker() {
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
  }
  showMapPicker.value = false
}

const saving = ref(false)
async function save() {
  if (!props.shot) return
  saving.value = true
  try {
    const key = await loadKey()
    if (!key) {
      toast.add({ title: t('errors.requestFailed'), color: 'error' })
      return
    }
    const hasLocation = lat.value != null || lng.value != null || locationText.value
    const locationPlain = hasLocation
      ? {
          text: locationText.value || null,
          latitude: lat.value,
          longitude: lng.value,
          accuracy_m: accuracy.value,
        }
      : null
    const payload = {
      frame_number: frameNumber.value,
      lens_id: lensId.value,
      aperture: aperture.value,
      shutter_speed: shutter.value || null,
      // null wipes the existing ciphertext on the server; keep that semantics
      // so users can clear notes / location by saving an empty form.
      location_encrypted: locationPlain ? await encryptJson(key, locationPlain) : null,
      notes_encrypted: notes.value ? await encryptString(key, notes.value) : null,
    }
    await api.patch(`/api/shots/${props.shot.id}`, payload)
    toast.add({ title: t('shotEdit.saved'), color: 'success' })
    emit('saved')
    emit('update:open', false)
  } catch {
    toast.add({ title: t('errors.requestFailed'), color: 'error' })
  } finally {
    saving.value = false
  }
}

const deleting = ref(false)
async function remove() {
  if (!props.shot) return
  if (!confirm(t('rollDetail.deleteShot'))) return
  deleting.value = true
  try {
    await api.del(`/api/shots/${props.shot.id}`)
    toast.add({ title: t('shotEdit.deleted'), color: 'success' })
    emit('deleted')
    emit('update:open', false)
  } catch {
    toast.add({ title: t('errors.requestFailed'), color: 'error' })
  } finally {
    deleting.value = false
  }
}

function close() { emit('update:open', false) }
</script>

<template>
  <UModal
    :open="open"
    :title="t('shotEdit.title')"
    :ui="{ content: 'sm:max-w-xl' }"
    @update:open="(v) => emit('update:open', v)"
  >
    <template #body>
      <div v-if="hydrating" class="text-sm text-muted py-4 text-center">
        {{ t('common.loading') }}
      </div>
      <form v-else class="flex flex-col gap-3" @submit.prevent="save">
        <UFormField :label="t('log.frame')">
          <UInput v-model.number="frameNumber" type="number" min="1" class="w-full" />
        </UFormField>

        <UFormField :label="t('log.lens')">
          <USelect
            v-model="lensId"
            :items="(allLenses ?? []).map(l => ({
              label: `${l.focal_length_mm}mm — ${l.name}`,
              value: l.id,
            }))"
            :placeholder="t('log.selectLens')"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('log.aperture')">
            <div class="flex flex-wrap gap-1">
              <UButton
                v-for="a in apertureChoices"
                :key="a.value"
                type="button"
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
            <UInput
              v-model="locationText"
              :placeholder="t('log.locationTextPlaceholder')"
            />
            <div v-if="lat != null && lng != null" class="text-xs text-muted">
              {{ lat.toFixed(4) }}, {{ lng.toFixed(4) }}
              <span v-if="accuracy != null"> · ±{{ accuracy.toFixed(0) }}m</span>
            </div>
            <UButton
              type="button"
              icon="i-lucide-map"
              :label="t('log.pickOnMap')"
              variant="outline"
              size="xs"
              @click="openMapPicker"
            />
            <ClientOnly v-if="showMapPicker">
              <div class="rounded-md border border-default p-2 mt-1 bg-elevated/30">
                <MapPicker
                  v-model="pickedLocation"
                  :current-location="lat != null && lng != null
                    ? { latitude: lat, longitude: lng, accuracy_m: accuracy }
                    : null"
                  :attribution="t('log.mapAttribution')"
                />
                <div class="flex justify-end gap-2 mt-2">
                  <UButton
                    type="button"
                    variant="outline"
                    size="xs"
                    :label="t('common.cancel')"
                    @click="showMapPicker = false"
                  />
                  <UButton
                    type="button"
                    color="primary"
                    size="xs"
                    :disabled="!pickedLocation"
                    :label="t('log.useThisSpot')"
                    @click="confirmMapPick"
                  />
                </div>
              </div>
            </ClientOnly>
          </div>
        </UFormField>

        <UFormField :label="t('log.notes')">
          <UTextarea v-model="notes" :rows="3" class="w-full" />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton
          type="button"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :loading="deleting"
          :label="t('common.delete')"
          @click="remove"
        />
        <div class="flex gap-2">
          <UButton
            type="button"
            variant="outline"
            :label="t('common.cancel')"
            @click="close"
          />
          <UButton
            type="button"
            color="primary"
            :loading="saving"
            :label="t('common.save')"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
