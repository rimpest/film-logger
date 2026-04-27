<script setup lang="ts">
const route = useRoute()
const api = useApi()
const rollId = Number(route.params.id)
const { t } = useI18n()

const { data: labs } = useCachedLabs()

const labId = ref<number | null>(null) // null = self-developed
const droppedOff = ref(new Date().toISOString().slice(0, 10))
const expected = ref('')
const process = ref('C-41')
const pushPull = ref(0)
const scans = ref(true)
const scanRes = ref('high')
const scanFormat = ref('JPEG')
const cost = ref<number | null>(null)
const currency = ref('MXN')
const notes = ref('')
const submitting = ref(false)

const PROCESSES = ['C-41', 'E-6', 'B&W', 'ECN-2', 'Other']

async function submit() {
  submitting.value = true
  try {
    const key = await loadKey()
    const notesCipher = notes.value && key
      ? await encryptString(key, notes.value)
      : null
    await api.post('/api/developments', {
      client_id: crypto.randomUUID(),
      roll_id: rollId,
      lab_id: labId.value,
      status: 'dropped_off',
      dropped_off_at: new Date(droppedOff.value).toISOString(),
      expected_ready_at: expected.value ? new Date(expected.value).toISOString() : null,
      process: process.value || null,
      push_pull_stops: pushPull.value,
      scans_requested: scans.value,
      scan_resolution: scans.value ? scanRes.value : null,
      scan_format: scans.value ? scanFormat.value : null,
      cost: cost.value,
      currency: cost.value != null ? currency.value : null,
      notes_encrypted: notesCipher,
    })
    await navigateTo(`/rolls/${rollId}`)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-xl font-semibold">{{ t('send.title') }}</h1>

    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <UFormField :label="t('send.lab')">
        <USelect
          v-model="labId"
          :items="[
            { label: t('rollDetail.selfDeveloped'), value: null },
            ...((labs ?? []).map(l => ({ label: l.name, value: l.id }))),
          ]"
          class="w-full"
        />
        <NuxtLink to="/labs" class="text-xs text-primary mt-1 inline-block">
          {{ t('send.addNewLab') }}
        </NuxtLink>
      </UFormField>

      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('send.dropOffDate')">
          <UInput v-model="droppedOff" type="date" />
        </UFormField>
        <UFormField :label="t('send.expectedReady')">
          <UInput v-model="expected" type="date" />
        </UFormField>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('send.process')">
          <USelect
            v-model="process"
            :items="PROCESSES.map(p => ({ label: p, value: p }))"
          />
        </UFormField>
        <UFormField :label="t('send.pushPull')">
          <UInput v-model.number="pushPull" type="number" min="-4" max="4" />
        </UFormField>
      </div>

      <UCheckbox v-model="scans" :label="t('send.requestScans')" />
      <div v-if="scans" class="grid grid-cols-2 gap-3">
        <UFormField :label="t('send.scanResolution')">
          <USelect
            v-model="scanRes"
            :items="[
              { label: t('send.scanResolutionOptions.low'), value: 'low' },
              { label: t('send.scanResolutionOptions.medium'), value: 'medium' },
              { label: t('send.scanResolutionOptions.high'), value: 'high' },
            ]"
          />
        </UFormField>
        <UFormField :label="t('send.scanFormat')">
          <USelect
            v-model="scanFormat"
            :items="['JPEG', 'TIFF', 'RAW'].map(v => ({ label: v, value: v }))"
          />
        </UFormField>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('send.cost')">
          <UInput v-model.number="cost" type="number" step="0.01" min="0" :placeholder="t('common.optional')" />
        </UFormField>
        <UFormField :label="t('send.currency')">
          <UInput v-model="currency" maxlength="3" />
        </UFormField>
      </div>

      <UFormField :label="t('send.notes')">
        <UTextarea v-model="notes" :rows="2" class="w-full" />
      </UFormField>

      <UButton type="submit" :loading="submitting" block :label="t('send.save')" color="primary" />
    </form>
  </div>
</template>
