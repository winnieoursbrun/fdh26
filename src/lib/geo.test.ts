import { describe, expect, it } from 'vitest'
import {
  bearingDegrees,
  compassLabel,
  distanceMeters,
  formatDistance,
  isOnSite,
  nearbyPlaces,
  places,
  type Place,
} from './geo'

// Deux vrais points du site, aux deux extrémités de la bande.
const ANGELA = { lat: 48.60703168525572, lng: 2.3472158841186967 }
const BAKER = { lat: 48.60180613559757, lng: 2.3392341102540684 }

describe('distanceMeters', () => {
  it('mesure la diagonale du site', () => {
    // Les deux scènes extrêmes sont à un peu plus de 800 m l'une de l'autre.
    expect(distanceMeters(ANGELA, BAKER)).toBeGreaterThan(780)
    expect(distanceMeters(ANGELA, BAKER)).toBeLessThan(880)
  })

  it('est nulle et symétrique', () => {
    expect(distanceMeters(ANGELA, ANGELA)).toBeCloseTo(0, 6)
    expect(distanceMeters(ANGELA, BAKER)).toBeCloseTo(distanceMeters(BAKER, ANGELA), 6)
  })

  it('retrouve une distance connue (1° de latitude ≈ 111 km)', () => {
    const d = distanceMeters({ lat: 48, lng: 2 }, { lat: 49, lng: 2 })
    expect(d / 1000).toBeGreaterThan(111)
    expect(d / 1000).toBeLessThan(112)
  })
})

describe('bearingDegrees / compassLabel', () => {
  it('donne le nord, l’est, le sud et l’ouest', () => {
    const o = { lat: 48.6, lng: 2.34 }
    expect(compassLabel(bearingDegrees(o, { lat: 48.61, lng: 2.34 }))).toBe('nord')
    expect(compassLabel(bearingDegrees(o, { lat: 48.6, lng: 2.35 }))).toBe('est')
    expect(compassLabel(bearingDegrees(o, { lat: 48.59, lng: 2.34 }))).toBe('sud')
    expect(compassLabel(bearingDegrees(o, { lat: 48.6, lng: 2.33 }))).toBe('ouest')
  })

  it('place Angela Davis au nord-est de Joséphine Baker', () => {
    expect(compassLabel(bearingDegrees(BAKER, ANGELA))).toBe('nord-est')
  })

  it('normalise les caps négatifs ou supérieurs à 360°', () => {
    expect(compassLabel(-90)).toBe('ouest')
    expect(compassLabel(450)).toBe('est')
  })
})

describe('formatDistance', () => {
  it('arrondit sans fausse précision', () => {
    expect(formatDistance(7)).toBe('10 m')
    expect(formatDistance(63)).toBe('60 m')
    expect(formatDistance(238)).toBe('250 m')
    expect(formatDistance(1234)).toBe('1,2 km')
  })
})

describe('nearbyPlaces', () => {
  it('classe du plus proche au plus lointain', () => {
    const near = nearbyPlaces(ANGELA, 3)
    expect(near[0].name).toBe('Scène Angela Davis')
    expect(near[0].meters).toBeLessThan(1)
    for (let i = 1; i < near.length; i += 1) {
      expect(near[i].meters).toBeGreaterThanOrEqual(near[i - 1].meters)
    }
  })

  it('ne répète pas un lieu relevé en plusieurs points', () => {
    // Le flux publie 7 « Sanitaires » et 6 « Point d'eau » à des endroits différents.
    const multi = places.filter((p) => p.name.trim() === 'Sanitaires')
    expect(multi.length).toBeGreaterThan(1)
    const names = nearbyPlaces(ANGELA, 20).map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('garde le point le plus proche d’un lieu qui en compte plusieurs', () => {
    const list: Place[] = [
      { num: 1, name: 'Sanitaires', group: 'bienetre', lat: 48.61, lng: 2.34 },
      { num: 1, name: 'Sanitaires', group: 'bienetre', lat: 48.6001, lng: 2.34 },
    ]
    const [closest] = nearbyPlaces({ lat: 48.6, lng: 2.34 }, 5, list)
    expect(closest.meters).toBeLessThan(20)
  })

  it('respecte la limite demandée', () => {
    expect(nearbyPlaces(ANGELA, 2)).toHaveLength(2)
  })
})

describe('isOnSite', () => {
  it('reconnaît un point au milieu du festival', () => {
    expect(isOnSite(ANGELA)).toBe(true)
  })

  it('rejette un point loin du site', () => {
    // Paris centre, à une trentaine de kilomètres.
    expect(isOnSite({ lat: 48.8566, lng: 2.3522 })).toBe(false)
  })
})

describe('places.json', () => {
  it('fournit des coordonnées plausibles pour chaque point', () => {
    expect(places.length).toBeGreaterThan(40)
    for (const p of places) {
      expect(p.name.trim()).not.toBe('')
      expect(p.lat).toBeGreaterThan(48.59)
      expect(p.lat).toBeLessThan(48.62)
      expect(p.lng).toBeGreaterThan(2.32)
      expect(p.lng).toBeLessThan(2.36)
    }
  })
})
