// Explicit `ref` import (in addition to Nuxt's auto-import) keeps this
// composable usable from unit tests that import it directly without booting
// Nuxt — the offline-queue test sidesteps this by re-implementing logic;
// here the composable is small enough that direct testing is preferable.
import { ref } from 'vue'

/**
 * Wraps the browser geolocation API with promise + Vue refs.
 *
 * Geolocation works offline — it's a device capability, not a network call —
 * so this is safe to invoke even on the log-shot screen with no signal.
 *
 * Two-stage strategy: try high-accuracy first (best on phones with GPS),
 * fall back to low-accuracy on failure. The fallback exists because some
 * Chromium builds on desktop Linux ship without a Google Geolocation API
 * key; their high-accuracy path POSTs to googleapis.com and gets back HTTP
 * 400, while low-accuracy may yield a usable IP-based estimate or at least
 * fail with a more informative error code.
 */
export interface ShotLocation {
  latitude: number
  longitude: number
  accuracy_m: number | null
}

export type GeolocationErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unknown'

function classify(err: GeolocationPositionError | Error | null): GeolocationErrorCode {
  if (!err) return 'unknown'
  if ('code' in err) {
    if (err.code === 1) return 'permission_denied'
    if (err.code === 2) return 'position_unavailable'
    if (err.code === 3) return 'timeout'
  }
  return 'unknown'
}

function tryGetPosition(opts: PositionOptions): Promise<{ ok: true, position: ShotLocation } | { ok: false, error: GeolocationPositionError }> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        ok: true,
        position: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy ?? null,
        },
      }),
      err => resolve({ ok: false, error: err }),
      opts,
    )
  })
}

export function useGeolocation() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const errorCode = ref<GeolocationErrorCode | null>(null)

  async function getCurrent(): Promise<ShotLocation | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      error.value = 'Geolocation not available'
      errorCode.value = 'unsupported'
      return null
    }
    loading.value = true
    error.value = null
    errorCode.value = null
    try {
      // First pass: high accuracy. On phones this prefers GPS.
      const first = await tryGetPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 30_000,
      })
      if (first.ok) return first.position

      // Permission denied is terminal — retrying won't help.
      if (first.error.code === 1) {
        error.value = first.error.message
        errorCode.value = 'permission_denied'
        return null
      }

      // Second pass: low accuracy. On Chromium without a Google API key
      // this often skips the failing network provider.
      const second = await tryGetPosition({
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 60_000,
      })
      if (second.ok) return second.position

      error.value = second.error.message
      errorCode.value = classify(second.error)
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, errorCode, getCurrent }
}
