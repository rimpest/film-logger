<script setup lang="ts">
const api = useApi()
const { data: cameras } = useCachedCameras()

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

const FRAME_PRESETS = [
  { label: '36 (35mm)', value: 36 },
  { label: '24 (35mm)', value: 24 },
  { label: '16 (645)', value: 16 },
  { label: '12 (6×6)', value: 12 },
  { label: '10 (6×7)', value: 10 },
  { label: '8 (6×9)', value: 8 },
  { label: '1 (sheet)', value: 1 },
]

async function submit() {
  if (!cameraId.value || !filmStock.value || !iso.value || !frameCount.value) return
  submitting.value = true
  try {
    const res = await api.post<{ id: number }>('/api/rolls', {
      client_id: crypto.randomUUID(),
      camera_id: cameraId.value,
      film_stock: filmStock.value.trim(),
      iso: iso.value,
      box_speed: boxSpeed.value,
      frame_count: frameCount.value,
      notes: notes.value || null,
    })
    await navigateTo(`/rolls/${res.id}`)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-xl font-semibold">Load a roll</h1>

    <UCard v-if="!cameras?.length">
      <div class="text-center py-6">
        <p class="font-medium">You need a camera first.</p>
        <UButton to="/cameras" class="mt-3" label="Add a camera" color="primary" />
      </div>
    </UCard>

    <form v-else class="flex flex-col gap-3" @submit.prevent="submit">
      <UFormField label="Camera" required>
        <USelect
          v-model="cameraId"
          :items="cameras.map(c => ({ label: `${c.name} (${c.format})`, value: c.id }))"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Film stock" required>
        <UInput v-model="filmStock" placeholder="e.g. Kodak Portra 400" class="w-full" />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Shooting ISO" required>
          <UInput v-model.number="iso" type="number" min="1" />
        </UFormField>
        <UFormField label="Box speed">
          <UInput v-model.number="boxSpeed" type="number" min="1" placeholder="(optional)" />
        </UFormField>
      </div>
      <UFormField label="Frames" required>
        <USelect
          v-model="frameCount"
          :items="FRAME_PRESETS"
          class="w-full"
        />
        <UInput v-model.number="frameCount" type="number" min="1" max="999" class="mt-2" />
      </UFormField>
      <UFormField label="Notes">
        <UTextarea v-model="notes" :rows="2" class="w-full" />
      </UFormField>
      <UButton type="submit" :loading="submitting" block label="Load roll" color="primary" />
    </form>
  </div>
</template>
