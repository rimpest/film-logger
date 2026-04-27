// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGeolocation } from '../../app/composables/useGeolocation'

type GetPos = (
  success: PositionCallback,
  error: PositionErrorCallback,
  options?: PositionOptions,
) => void

let calls: PositionOptions[] = []
let impl: GetPos = () => {}

function installNavigatorMock() {
  calls = []
  const wrapped: GetPos = (s, e, o) => {
    calls.push(o ?? {})
    return impl(s, e, o)
  }
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { geolocation: { getCurrentPosition: wrapped } },
  })
  // import.meta.client is true in happy-dom env, but the composable also
  // checks navigator.geolocation, which we just installed.
}

beforeEach(installNavigatorMock)
afterEach(() => { vi.restoreAllMocks() })

function err(code: 1 | 2 | 3, message = 'mock'): GeolocationPositionError {
  // GeolocationPositionError isn't constructable in jsdom/happy-dom, so build
  // a structurally-compatible object — the composable only reads .code/.message.
  return { code, message, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError
}

function pos(latitude: number, longitude: number, accuracy: number | null = 12): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: accuracy as number,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as GeolocationPosition
}

describe('useGeolocation', () => {
  it('returns coords on the first attempt when high-accuracy succeeds', async () => {
    impl = (s) => s(pos(10, 20, 5))
    const geo = useGeolocation()
    const out = await geo.getCurrent()
    expect(out).toEqual({ latitude: 10, longitude: 20, accuracy_m: 5 })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.enableHighAccuracy).toBe(true)
    expect(geo.errorCode.value).toBe(null)
  })

  it('retries with low accuracy when high-accuracy fails with POSITION_UNAVAILABLE (the Google-400 case)', async () => {
    let attempt = 0
    impl = (s, e) => {
      attempt += 1
      if (attempt === 1) e(err(2, 'network provider 400'))
      else s(pos(40, -3, 200))
    }
    const geo = useGeolocation()
    const out = await geo.getCurrent()
    expect(out).toEqual({ latitude: 40, longitude: -3, accuracy_m: 200 })
    expect(calls).toHaveLength(2)
    expect(calls[0]?.enableHighAccuracy).toBe(true)
    expect(calls[1]?.enableHighAccuracy).toBe(false)
  })

  it('does NOT retry when permission is denied (terminal)', async () => {
    impl = (_s, e) => e(err(1, 'denied'))
    const geo = useGeolocation()
    const out = await geo.getCurrent()
    expect(out).toBe(null)
    expect(calls).toHaveLength(1)
    expect(geo.errorCode.value).toBe('permission_denied')
  })

  it('surfaces position_unavailable when both attempts fail', async () => {
    impl = (_s, e) => e(err(2, 'still no'))
    const geo = useGeolocation()
    const out = await geo.getCurrent()
    expect(out).toBe(null)
    expect(calls).toHaveLength(2)
    expect(geo.errorCode.value).toBe('position_unavailable')
  })

  it('surfaces timeout when both attempts time out', async () => {
    impl = (_s, e) => e(err(3, 'timeout'))
    const geo = useGeolocation()
    const out = await geo.getCurrent()
    expect(out).toBe(null)
    expect(geo.errorCode.value).toBe('timeout')
  })
})
