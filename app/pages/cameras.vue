<script setup lang="ts">
import type { Camera } from '~~/types/models'

const api = useApi()
const { data: cameras, refresh } = useCachedCameras()
const { t } = useI18n()

// `notes` here is a parallel plaintext ref the user types into. We hold the
// ciphertext on `editing.notes_encrypted` only when sending, never as a v-model.
const editing = ref<(Partial<Camera> & { id?: number, notes?: string | null }) | null>(null)

const FORMATS = computed(() => [
  { label: t('cameras.formats.f135'), value: '135' },
  { label: t('cameras.formats.f120'), value: '120' },
  { label: t('cameras.formats.f4x5'), value: '4x5' },
  { label: t('cameras.formats.f8x10'), value: '8x10' },
  { label: t('cameras.formats.other'), value: 'other' },
])

function startNew() {
  editing.value = { name: '', format: '135', has_interchangeable_back: 0, notes: '' }
}
async function startEdit(c: Camera) {
  // Ciphertext → plaintext for the textarea.
  const key = await loadKey()
  let plain: string | null = null
  if (key && c.notes_encrypted) {
    try { plain = await decryptText(key, c.notes_encrypted) } catch { plain = null }
  }
  editing.value = { ...c, notes: plain ?? '' }
}
function cancel() { editing.value = null }

async function save() {
  if (!editing.value || !editing.value.name || !editing.value.format) return
  const key = await loadKey()
  const notesCipher = editing.value.notes && key
    ? await encryptString(key, editing.value.notes)
    : null
  const payload = {
    client_id: editing.value.client_id ?? crypto.randomUUID(),
    name: editing.value.name,
    format: editing.value.format,
    has_interchangeable_back: !!editing.value.has_interchangeable_back,
    notes_encrypted: notesCipher,
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
  if (!confirm(t('cameras.deleteConfirm', { name: c.name }))) return
  await api.del(`/api/cameras/${c.id}`)
  await refresh()
}

// Decrypt notes for inline display under each camera card.
const notesPlain = reactive(new Map<string, string>())
watch(cameras, async (list) => {
  const key = await loadKey()
  if (!key) return
  for (const c of list ?? []) {
    if (c.notes_encrypted && !notesPlain.has(c.notes_encrypted)) {
      try {
        const txt = await decryptText(key, c.notes_encrypted)
        if (txt) notesPlain.set(c.notes_encrypted, txt)
      } catch { /* ignore */ }
    }
  }
}, { immediate: true })
function notesOf(c: Camera): string | null {
  return c.notes_encrypted ? (notesPlain.get(c.notes_encrypted) ?? null) : null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('cameras.title') }}</h1>
      <UButton icon="i-lucide-plus" :label="t('cameras.addCamera')" color="primary" @click="startNew" />
    </header>

    <UCard v-if="editing">
      <template #header>
        <div class="text-sm font-medium">{{ editing.id ? t('cameras.editCamera') : t('cameras.newCamera') }}</div>
      </template>
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <UFormField :label="t('cameras.name')" required>
          <UInput v-model="editing.name" :placeholder="t('cameras.namePlaceholder')" class="w-full" />
        </UFormField>
        <UFormField :label="t('cameras.format')" required>
          <USelect v-model="editing.format" :items="FORMATS" class="w-full" />
        </UFormField>
        <UCheckbox
          :model-value="!!editing.has_interchangeable_back"
          :label="t('cameras.interchangeableBack')"
          @update:model-value="editing.has_interchangeable_back = $event ? 1 : 0"
        />
        <UFormField :label="t('cameras.notes')">
          <UTextarea v-model="editing.notes" :rows="2" class="w-full" />
        </UFormField>
        <div class="flex gap-2">
          <UButton type="submit" color="primary" :label="t('common.save')" />
          <UButton type="button" variant="outline" :label="t('common.cancel')" @click="cancel" />
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
          <div class="text-sm text-muted">{{ c.format }}{{ c.has_interchangeable_back ? ' · ' + t('cameras.interchangeableBackBadge') : '' }}</div>
          <div v-if="notesOf(c)" class="text-xs text-muted mt-1 truncate">{{ notesOf(c) }}</div>
        </div>
        <div class="flex gap-1 shrink-0">
          <UButton icon="i-lucide-pencil" variant="ghost" size="xs" @click="startEdit(c)" />
          <UButton icon="i-lucide-trash-2" variant="ghost" color="error" size="xs" @click="remove(c)" />
        </div>
      </div>
    </div>
    <UCard v-else-if="!editing">
      <div class="text-center py-6 text-muted">
        {{ t('cameras.empty') }}
      </div>
    </UCard>
  </div>
</template>
