<script setup lang="ts">
import type { Lens } from '~~/types/models'

const api = useApi()
const { data: lenses, refresh } = useCachedLenses()
const { data: cameras } = useCachedCameras()
const { t } = useI18n()

interface Edit extends Partial<Lens> {
  id?: number
  camera_ids?: number[]
  /** Plaintext notes the user is typing — encrypted on save. */
  notes?: string | null
}
const editing = ref<Edit | null>(null)

function startNew() {
  editing.value = { name: '', focal_length_mm: 50, camera_ids: [], notes: '' }
}

async function startEdit(l: Lens) {
  // Fetch detail to get tagged cameras.
  const detail = await api.get<Lens & { camera_ids: number[] }>(`/api/lenses/${l.id}`)
  const key = await loadKey()
  let plain: string | null = null
  if (key && detail.notes_encrypted) {
    try { plain = await decryptText(key, detail.notes_encrypted) } catch {}
  }
  editing.value = { ...detail, notes: plain ?? '' }
}

function cancel() { editing.value = null }

async function save() {
  if (!editing.value?.name || !editing.value?.focal_length_mm) return
  const key = await loadKey()
  const notesCipher = editing.value.notes && key
    ? await encryptString(key, editing.value.notes)
    : null
  const payload = {
    client_id: editing.value.client_id ?? crypto.randomUUID(),
    name: editing.value.name,
    focal_length_mm: editing.value.focal_length_mm,
    max_aperture: editing.value.max_aperture ?? null,
    min_aperture: editing.value.min_aperture ?? null,
    mount: editing.value.mount ?? null,
    notes_encrypted: notesCipher,
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
  if (!confirm(t('lenses.deleteConfirm', { name: l.name }))) return
  await api.del(`/api/lenses/${l.id}`)
  await refresh()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('lenses.title') }}</h1>
      <UButton icon="i-lucide-plus" :label="t('lenses.addLens')" color="primary" @click="startNew" />
    </header>

    <UCard v-if="editing">
      <template #header>
        <div class="text-sm font-medium">{{ editing.id ? t('lenses.editLens') : t('lenses.newLens') }}</div>
      </template>
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <UFormField :label="t('lenses.name')" required>
          <UInput v-model="editing.name" :placeholder="t('lenses.namePlaceholder')" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-3 gap-3">
          <UFormField :label="t('lenses.focalLengthMm')" required>
            <UInput v-model.number="editing.focal_length_mm" type="number" min="1" />
          </UFormField>
          <UFormField :label="t('lenses.maxAperture')">
            <UInput v-model.number="editing.max_aperture" type="number" step="0.1" />
          </UFormField>
          <UFormField :label="t('lenses.minAperture')">
            <UInput v-model.number="editing.min_aperture" type="number" step="0.1" />
          </UFormField>
        </div>
        <UFormField :label="t('lenses.mount')">
          <UInput v-model="editing.mount" :placeholder="t('lenses.mountPlaceholder')" class="w-full" />
        </UFormField>
        <UFormField v-if="cameras?.length" :label="t('lenses.fitsCameras')">
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
        <UFormField :label="t('lenses.notes')">
          <UTextarea v-model="editing.notes" :rows="2" class="w-full" />
        </UFormField>
        <div class="flex gap-2">
          <UButton type="submit" color="primary" :label="t('common.save')" />
          <UButton type="button" variant="outline" :label="t('common.cancel')" @click="cancel" />
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
      <div class="text-center py-6 text-muted">{{ t('lenses.empty') }}</div>
    </UCard>
  </div>
</template>
