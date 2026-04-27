/**
 * Place-name search for the map picker.
 *
 * Proxies OpenStreetMap's free Nominatim service so we can:
 *   1. Send the User-Agent the OSM tile usage policy requires (browsers
 *      generally don't let JS set this header).
 *   2. Gate behind auth so this endpoint isn't a free open-relay geocoder
 *      that anyone on the internet can hammer.
 *   3. Return a small, predictable shape instead of Nominatim's verbose JSON.
 *
 * Nominatim usage policy summary (https://operations.osmfoundation.org/policies/nominatim/):
 *   - max 1 req/sec from a single source
 *   - identify yourself in the User-Agent
 *   - cache results when reasonable
 *   - heavy use → run your own instance
 *
 * For a personal film logger we're nowhere near the threshold; if usage grows
 * the right move is hosting a Nominatim instance (or swapping to Photon).
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'film-logger/1.0 (https://github.com/rimpest/film-logger)'

interface NominatimHit {
  place_id: number
  lat: string
  lon: string
  display_name: string
}

export interface GeocodeResult {
  id: number
  name: string
  latitude: number
  longitude: number
}

export default defineEventHandler(async (event): Promise<GeocodeResult[]> => {
  await requireUserId(event)
  const q = String(getQuery(event).q ?? '').trim()
  if (q.length < 2) return []

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`
  let hits: NominatimHit[]
  try {
    hits = await $fetch<NominatimHit[]>(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'Accept-Language': getRequestHeader(event, 'accept-language') ?? 'en',
      },
    })
  } catch {
    // Don't leak Nominatim's failure modes — empty result is the right UX
    // signal ("no places found"), and the user can always pick on the map.
    return []
  }

  return hits.map(h => ({
    id: h.place_id,
    name: h.display_name,
    latitude: parseFloat(h.lat),
    longitude: parseFloat(h.lon),
  }))
})
