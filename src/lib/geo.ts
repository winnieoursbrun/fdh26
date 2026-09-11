import placesData from '../data/places.json'

export interface Place {
  num: number
  name: string
  group: string
  lat: number
  lng: number
}

export interface Point {
  lat: number
  lng: number
}

export const places = placesData as Place[]

const EARTH_RADIUS_M = 6_371_000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Distance en mètres entre deux points (haversine). */
export function distanceMeters(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/** Cap en degrés depuis le nord, dans le sens horaire. */
export function bearingDegrees(from: Point, to: Point): number {
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)
  const dLng = toRad(to.lng - from.lng)
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180) / Math.PI
}

const COMPASS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest']

/** Point cardinal lisible (8 secteurs de 45°). */
export function compassLabel(bearing: number): string {
  const normalized = ((bearing % 360) + 360) % 360
  return COMPASS[Math.round(normalized / 45) % 8]
}

/** Distance arrondie de façon honnête : pas de fausse précision au-delà de 100 m. */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    const step = meters < 100 ? 10 : 50
    return `${Math.round(meters / step) * step} m`
  }
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

export interface NearbyPlace {
  name: string
  group: string
  meters: number
  bearing: number
}

/**
 * Les lieux les plus proches, du plus proche au plus lointain. Un même lieu peut
 * compter plusieurs points relevés (7 sanitaires, 6 points d'eau) : on ne garde
 * que le plus proche de chaque nom, sinon la liste se remplit de doublons.
 */
export function nearbyPlaces(from: Point, limit = 3, list: Place[] = places): NearbyPlace[] {
  const best = new Map<string, NearbyPlace>()
  for (const place of list) {
    const meters = distanceMeters(from, place)
    const previous = best.get(place.name)
    if (!previous || meters < previous.meters) {
      best.set(place.name, {
        name: place.name,
        group: place.group,
        meters,
        bearing: bearingDegrees(from, place),
      })
    }
  }
  return [...best.values()].sort((a, b) => a.meters - b.meters).slice(0, limit)
}

// Emprise des points relevés, élargie d'une marge : au-delà, on n'est pas sur le
// site et afficher « tu es à côté de telle scène » n'aurait aucun sens.
const OFF_SITE_MARGIN_M = 400

export function isOnSite(from: Point, list: Place[] = places): boolean {
  return list.some((place) => distanceMeters(from, place) <= OFF_SITE_MARGIN_M)
}
