<script setup lang="ts">
import type { Camera } from '~~/types/models'

const api = useApi()
const { data: cameras, refresh } = await useFetch<Camera[]>('/api/cameras', { default: () => [] })

const editing = ref<Partial<Camera> & { id?: number } | null>(null)
const FORMATS = [
  { label: '35mm (135)', value: '135' },
  { label: '120 / medium format', value: '120' },
  { label: '4×5 large format', value: '4x5' },
  { label: '8×10 large format', value: '8x10' },
  { label: 'Other', value: 'other' },
]

function startNew() {
  editing.value = { name: '', format: '135', has_interchangeable_back: 0 }
}
function startEdit(c: Camera) {
  editing.value = { ...c }
}
function cancel() { editing.value = null }

async function save() {
  if (!editing.value || !editing.value.name || !editing.value.format) return
  const payload = {
    client_id: editing.value.client_id ?? crypto.randomUUID(),
    name: editing.value.name,
    format: editing.value.format,
    has_interchangeable_back: !!editing.value.has_interchangeable_back,
    notes: editing.value.notes ?? null,
  }
  if (editing.value.id) {
    await api.patch(`/api/cameras/${editing.value.id}`, payload)
  } else {
    await api.post('/api/cameras', payload)
  }
  editing.value = null
  await refresh()
}

async function remove(c: Camera) {
  if (!confirm(`Delete ${c.name}?`)) return
  await api.del(`/api/cameras/${c.id}`)
  await refresh()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Cameras</h1>
      <UButton icon="i-lucide-plus" label="Add camera" color="primary" @click="startNew" />
    </header>

    <UCard v-if="editing">
      <template #header>
        <div class="text-sm font-medium">{{ editing.id ? 'Edit camera' : 'New camera' }}</div>
      </template>
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <UFormField label="Name" required>
          <UInput v-model="editing.name" placeholder="e.g. Hasselblad 500 C/M" class="w-full" />
        </UFormField>
        <UFormField label="Format" required>
          <USelect v-model="editing.format" :items="FORMATS" class="w-full" />
        </UFormField>
        <UCheckbox
          :model-value="!!editing.has_interchangeable_back"
          label="Has interchangeable back"
          @update:model-value="editing.has_interchangeable_back = $event ? 1 : 0"
        />
        <UFormField label="Notes">
          <UTextarea v-model="editing.notes" :rows="2" class="w-full" />
        </UFormField>
        <div class="flex gap-2">
          <UButton type="submit" color="primary" label="Save" />
          <UButton type="button" variant="outline" label="Cancel" @click="cancel" />
        </div>
      </form>
    </UCard>

    <div v-if="cameras?.length" class="flex flex-col gap-2">
      <div
        v-for="c in cameras"
        :key="c.id"
        class="rounded-lg border border-default bg-elevated/40 p-4 flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <div class="font-medium truncate">{{ c.name }}</div>
          <div class="text-sm text-muted">{{ c.format }}{{ c.has_interchangeable_back ? ' · interchangeable back' : '' }}</div>
          <div v-if="c.notes" class="text-xs text-muted mt-1 truncate">{{ c.notes }}</div>
        </div>
        <div class="flex gap-1 shrink-0">
          <UButton icon="i-lucide-pencil" variant="ghost" size="xs" @click="startEdit(c)" />
          <UButton icon="i-lucide-trash-2" variant="ghost" color="error" size="xs" @click="remove(c)" />
        </div>
      </div>
    </div>
    <UCard v-else-if="!editing">
      <div class="text-center py-6 text-muted">
        No cameras yet. Add your first one to start logging.
      </div>
    </UCard>
  </div>
</template>
