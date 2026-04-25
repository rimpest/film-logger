/**
 * Wraps the browser geolocation API with promise + Vue refs.
 * Geolocation works offline — it's a device capability, not a network call —
 * so this is safe to invoke even on the log-shot screen with no signal.
 */
export interface ShotLocation {
  latitude: number
  longitude: number
  accuracy_m: number | null
}

export function useGeolocation() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getCurrent(): Promise<ShotLocation | null> {
    if (!import.meta.client || !navigator.geolocation) {
      error.value = 'Geolocation not available'
      return null
    }
    loading.value = true
    error.value = null
    try {
      return await new Promise<ShotLocation>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy_m: pos.coords.accuracy ?? null,
            })
          },
          (err) => reject(new Error(err.message)),
          { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
        )
      })
    } catch (e: any) {
      error.value = e?.message ?? 'Could not get location'
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, getCurrent }
}
