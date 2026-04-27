<script setup lang="ts">
import type { Lab } from '~~/types/models'

const api = useApi()
const { data: labs, refresh } = useCachedLabs()
const { t } = useI18n()

const editing = ref<(Partial<Lab> & { id?: number, notes?: string | null }) | null>(null)

function startNew() { editing.value = { name: '', notes: '' } }
async function startEdit(l: Lab) {
  const key = await loadKey()
  let plain: string | null = null
  if (key && l.notes_encrypted) {
    try { plain = await decryptText(key, l.notes_encrypted) } catch {}
  }
  editing.value = { ...l, notes: plain ?? '' }
}
function cancel() { editing.value = null }

async function save() {
  if (!editing.value?.name) return
  const key = await loadKey()
  const notesCipher = editing.value.notes && key
    ? await encryptString(key, editing.value.notes)
    : null
  const payload = {
    client_id: editing.value.client_id ?? crypto.randomUUID(),
    name: editing.value.name,
    address: editing.value.address ?? null,
    phone: editing.value.phone ?? null,
    website: editing.value.website ?? null,
    notes_encrypted: notesCipher,
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
  if (!confirm(t('labs.deleteConfirm', { name: l.name }))) return
  await api.del(`/api/labs/${l.id}`)
  await refresh()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('labs.title') }}</h1>
      <UButton icon="i-lucide-plus" :label="t('labs.addLab')" color="primary" @click="startNew" />
    </header>

    <UCard v-if="editing">
      <template #header>
        <div class="text-sm font-medium">{{ editing.id ? t('labs.editLab') : t('labs.newLab') }}</div>
      </template>
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <UFormField :label="t('labs.name')" required>
          <UInput v-model="editing.name" class="w-full" />
        </UFormField>
        <UFormField :label="t('labs.address')">
          <UInput v-model="editing.address" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('labs.phone')">
            <UInput v-model="editing.phone" />
          </UFormField>
          <UFormField :label="t('labs.website')">
            <UInput v-model="editing.website" type="url" :placeholder="t('labs.websitePlaceholder')" />
          </UFormField>
        </div>
        <UFormField :label="t('labs.notes')">
          <UTextarea v-model="editing.notes" :rows="2" class="w-full" />
        </UFormField>
        <div class="flex gap-2">
          <UButton type="submit" color="primary" :label="t('common.save')" />
          <UButton type="button" variant="outline" :label="t('common.cancel')" @click="cancel" />
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
      <div class="text-center py-6 text-muted">{{ t('labs.empty') }}</div>
    </UCard>
  </div>
</template>
