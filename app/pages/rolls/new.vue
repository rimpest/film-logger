<script setup lang="ts">
import { defaultFrameCountFor, framePresetsFor } from '~~/shared/frame-presets'

const api = useApi()
const { data: cameras } = useCachedCameras()
const { t } = useI18n()

const cameraId = ref<number | null>(null)
const filmStock = ref('')
const iso = ref<number | null>(400)
const boxSpeed = ref<number | null>(null)
const frameCount = ref<number | null>(36)
const notes = ref('')
const submitting = ref(false)
const showAllFormats = ref(false)

watch(cameras, (val) => {
  if (val?.length && cameraId.value == null) cameraId.value = val[0].id
}, { immediate: true })

const selectedCamera = computed(() =>
  cameras.value?.find(c => c.id === cameraId.value) ?? null,
)

// Keep the displayed frame-count chips relevant to the chosen camera. The
// "show all" toggle is the escape hatch for half-shot rolls or odd backs.
const visibleFrameValues = computed(() =>
  showAllFormats.value
    ? framePresetsFor('other')
    : framePresetsFor(selectedCamera.value?.format),
)

const FRAME_LABELS: Record<number, string> = {
  36: t('rollNew.framePreset.f36'),
  24: t('rollNew.framePreset.f24'),
  16: t('rollNew.framePreset.f16'),
  12: t('rollNew.framePreset.f12'),
  10: t('rollNew.framePreset.f10'),
  8: t('rollNew.framePreset.f8'),
  1: t('rollNew.framePreset.f1'),
}

const visibleFramePresets = computed(() =>
  visibleFrameValues.value.map(v => ({ label: FRAME_LABELS[v] ?? String(v), value: v })),
)

// Reset frame count to the format's default whenever the user picks a different
// camera. Predictable beats trying to preserve a value that probably doesn't
// fit the new format (you don't load 36-exp into a 4×5).
watch(() => selectedCamera.value?.format, (format) => {
  if (format) frameCount.value = defaultFrameCountFor(format)
}, { immediate: true })

async function submit() {
  if (!cameraId.value || !filmStock.value || !iso.value || !frameCount.value) return
  submitting.value = true
  try {
    const key = await loadKey()
    const notesCipher = notes.value && key
      ? await encryptString(key, notes.value)
      : null
    const res = await api.post<{ id: number }>('/api/rolls', {
      client_id: crypto.randomUUID(),
      camera_id: cameraId.value,
      film_stock: filmStock.value.trim(),
      iso: iso.value,
      box_speed: boxSpeed.value,
      frame_count: frameCount.value,
      notes_encrypted: notesCipher,
    })
    await navigateTo(`/rolls/${res.id}`)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-xl font-semibold">{{ t('rollNew.title') }}</h1>

    <UCard v-if="!cameras?.length">
      <div class="text-center py-6">
        <p class="font-medium">{{ t('rollNew.needCameraFirst') }}</p>
        <UButton to="/cameras" class="mt-3" :label="t('rollNew.addACamera')" color="primary" />
      </div>
    </UCard>

    <form v-else class="flex flex-col gap-3" @submit.prevent="submit">
      <UFormField :label="t('rollNew.camera')" required>
        <USelect
          v-model="cameraId"
          :items="cameras.map(c => ({ label: `${c.name} (${c.format})`, value: c.id }))"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('rollNew.filmStock')" required>
        <UInput v-model="filmStock" :placeholder="t('rollNew.filmStockPlaceholder')" class="w-full" />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('rollNew.shootingIso')" required>
          <UInput v-model.number="iso" type="number" min="1" />
        </UFormField>
        <UFormField :label="t('rollNew.boxSpeed')">
          <UInput v-model.number="boxSpeed" type="number" min="1" :placeholder="t('common.optional')" />
        </UFormField>
      </div>
      <UFormField :label="t('rollNew.frames')" required>
        <USelect
          v-model="frameCount"
          :items="visibleFramePresets"
          class="w-full"
        />
        <UCheckbox
          v-model="showAllFormats"
          :label="t('rollNew.showAllFormats')"
          class="mt-2"
        />
        <UInput v-model.number="frameCount" type="number" min="1" max="999" class="mt-2" />
      </UFormField>
      <UFormField :label="t('rollNew.notes')">
        <UTextarea v-model="notes" :rows="2" class="w-full" />
      </UFormField>
      <UButton type="submit" :loading="submitting" block :label="t('rollNew.loadRoll')" color="primary" />
    </form>
  </div>
</template>
