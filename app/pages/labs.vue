<script setup lang="ts">
import type { Lab } from '~~/types/models'

const api = useApi()
const { data: labs, refresh } = useCachedLabs()

const editing = ref<Partial<Lab> & { id?: number } | null>(null)

function startNew() { editing.value = { name: '' } }
function startEdit(l: Lab) { editing.value = { ...l } }
function cancel() { editing.value = null }

async function save() {
  if (!editing.value?.name) return
  const payload = {
    client_id: editing.value.client_id ?? crypto.randomUUID(),
    name: editing.value.name,
    address: editing.value.address ?? null,
    phone: editing.value.phone ?? null,
    website: editing.value.website ?? null,
    notes: editing.value.notes ?? null,
  }
  if (editing.value.id) {
    await api.patch(`/api/labs/${editing.value.id}`, payload)
  } else {
    await api.post('/api/labs', payload)
  }
  editing.value = null
  await refresh()
}

async function remove(l: Lab) {
  if (!confirm(`Delete ${l.name}?`)) return
  await api.del(`/api/labs/${l.id}`)
  await refresh()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Labs</h1>
      <UButton icon="i-lucide-plus" label="Add lab" color="primary" @click="startNew" />
    </header>

    <UCard v-if="editing">
      <template #header>
        <div class="text-sm font-medium">{{ editing.id ? 'Edit lab' : 'New lab' }}</div>
      </template>
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <UFormField label="Name" required>
          <UInput v-model="editing.name" class="w-full" />
        </UFormField>
        <UFormField label="Address">
          <UInput v-model="editing.address" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Phone">
            <UInput v-model="editing.phone" />
          </UFormField>
          <UFormField label="Website">
            <UInput v-model="editing.website" type="url" placeholder="https://" />
          </UFormField>
        </div>
        <UFormField label="Notes">
          <UTextarea v-model="editing.notes" :rows="2" class="w-full" />
        </UFormField>
        <div class="flex gap-2">
          <UButton type="submit" color="primary" label="Save" />
          <UButton type="button" variant="outline" label="Cancel" @click="cancel" />
        </div>
      </form>
    </UCard>

    <div v-if="labs?.length" class="flex flex-col gap-2">
      <div
        v-for="l in labs"
        :key="l.id"
        class="rounded-lg border border-default bg-elevated/40 p-4 flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <div class="font-medium truncate">{{ l.name }}</div>
          <div v-if="l.address" class="text-sm text-muted truncate">{{ l.address }}</div>
          <div class="text-xs text-muted truncate">
            <span v-if="l.phone">{{ l.phone }}</span>
            <span v-if="l.website" class="ml-2">{{ l.website }}</span>
          </div>
        </div>
        <div class="flex gap-1 shrink-0">
          <UButton icon="i-lucide-pencil" variant="ghost" size="xs" @click="startEdit(l)" />
          <UButton icon="i-lucide-trash-2" variant="ghost" color="error" size="xs" @click="remove(l)" />
        </div>
      </div>
    </div>
    <UCard v-else-if="!editing">
      <div class="text-center py-6 text-muted">No labs yet.</div>
    </UCard>
  </div>
</template>
