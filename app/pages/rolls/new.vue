<script setup lang="ts">
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

watch(cameras, (val) => {
  if (val?.length && cameraId.value == null) cameraId.value = val[0].id
}, { immediate: true })

const FRAME_PRESETS = computed(() => [
  { label: t('rollNew.framePreset.f36'), value: 36 },
  { label: t('rollNew.framePreset.f24'), value: 24 },
  { label: t('rollNew.framePreset.f16'), value: 16 },
  { label: t('rollNew.framePreset.f12'), value: 12 },
  { label: t('rollNew.framePreset.f10'), value: 10 },
  { label: t('rollNew.framePreset.f8'), value: 8 },
  { label: t('rollNew.framePreset.f1'), value: 1 },
])

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
          :items="FRAME_PRESETS"
          class="w-full"
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
