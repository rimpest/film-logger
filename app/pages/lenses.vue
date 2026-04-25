<script setup lang="ts">
import type { Camera, Lens } from '~~/types/models'

const api = useApi()
const { data: lenses, refresh } = useCachedLenses()
const { data: cameras } = useCachedCameras()

interface Edit extends Partial<Lens> { id?: number, camera_ids?: number[] }
const editing = ref<Edit | null>(null)

function startNew() {
  editing.value = { name: '', focal_length_mm: 50, camera_ids: [] }
}

async function startEdit(l: Lens) {
  // Fetch detail to get tagged cameras.
  const detail = await api.get<Lens & { camera_ids: number[] }>(`/api/lenses/${l.id}`)
  editing.value = { ...detail }
}

function cancel() { editing.value = null }

async function save() {
  if (!editing.value?.name || !editing.value?.focal_length_mm) return
  const payload = {
    client_id: editing.value.client_id ?? crypto.randomUUID(),
    name: editing.value.name,
    focal_length_mm: editing.value.focal_length_mm,
    max_aperture: editing.value.max_aperture ?? null,
    min_aperture: editing.value.min_aperture ?? null,
    mount: editing.value.mount ?? null,
    notes: editing.value.notes ?? null,
    camera_ids: editing.value.camera_ids ?? [],
  }
  if (editing.value.id) {
    await api.patch(`/api/lenses/${editing.value.id}`, payload)
  } else {
    await api.post('/api/lenses', payload)
  }
  editing.value = null
  await refresh()
}

async function remove(l: Lens) {
  if (!confirm(`Delete ${l.name}?`)) return
  await api.del(`/api/lenses/${l.id}`)
  await refresh()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Lenses</h1>
      <UButton icon="i-lucide-plus" label="Add lens" color="primary" @click="startNew" />
    </header>

    <UCard v-if="editing">
      <template #header>
        <div class="text-sm font-medium">{{ editing.id ? 'Edit lens' : 'New lens' }}</div>
      </template>
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <UFormField label="Name" required>
          <UInput v-model="editing.name" placeholder="e.g. Zeiss Planar 80mm f/2.8" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-3 gap-3">
          <UFormField label="Focal length (mm)" required>
            <UInput v-model.number="editing.focal_length_mm" type="number" min="1" />
          </UFormField>
          <UFormField label="Max aperture (f/)">
            <UInput v-model.number="editing.max_aperture" type="number" step="0.1" />
          </UFormField>
          <UFormField label="Min aperture (f/)">
            <UInput v-model.number="editing.min_aperture" type="number" step="0.1" />
          </UFormField>
        </div>
        <UFormField label="Mount">
          <UInput v-model="editing.mount" placeholder="e.g. V-system" class="w-full" />
        </UFormField>
        <UFormField label="Fits cameras" v-if="cameras?.length">
          <div class="flex flex-wrap gap-2">
            <UCheckbox
              v-for="c in cameras"
              :key="c.id"
              :model-value="editing.camera_ids?.includes(c.id) ?? false"
              :label="c.name"
              @update:model-value="(v) => {
                if (!editing) return
                const ids = new Set(editing.camera_ids ?? [])
                v ? ids.add(c.id) : ids.delete(c.id)
                editing.camera_ids = [...ids]
              }"
            />
          </div>
        </UFormField>
        <UFormField label="Notes">
          <UTextarea v-model="editing.notes" :rows="2" class="w-full" />
        </UFormField>
        <div class="flex gap-2">
          <UButton type="submit" color="primary" label="Save" />
          <UButton type="button" variant="outline" label="Cancel" @click="cancel" />
        </div>
      </form>
    </UCard>

    <div v-if="lenses?.length" class="flex flex-col gap-2">
      <div
        v-for="l in lenses"
        :key="l.id"
        class="rounded-lg border border-default bg-elevated/40 p-4 flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <div class="font-medium truncate">{{ l.name }}</div>
          <div class="text-sm text-muted">
            {{ l.focal_length_mm }}mm
            <span v-if="l.max_aperture"> · f/{{ l.max_aperture }}</span>
            <span v-if="l.mount"> · {{ l.mount }}</span>
          </div>
        </div>
        <div class="flex gap-1 shrink-0">
          <UButton icon="i-lucide-pencil" variant="ghost" size="xs" @click="startEdit(l)" />
          <UButton icon="i-lucide-trash-2" variant="ghost" color="error" size="xs" @click="remove(l)" />
        </div>
      </div>
    </div>
    <UCard v-else-if="!editing">
      <div class="text-center py-6 text-muted">No lenses yet.</div>
    </UCard>
  </div>
</template>
