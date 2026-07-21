import { describe, expect, it } from 'vitest'
import { buildRecapSlides, computeRecapStats, isRecapReady } from './recap'
import type { FestEvent } from '../types'

function makeEvent(overrides: Partial<FestEvent>): FestEvent {
  return {
    id: 'test-event',
    title: 'Test',
    artist: null,
    day: 'sam',
    start: '21:00',
    end: '22:00',
    venue: 'Scène test',
    category: 'concert',
    subtype: null,
    description: null,
    ...overrides,
  }
}

describe('isRecapReady', () => {
  it('est faux avant lundi 9h', () => {
    expect(isRecapReady(new Date(2026, 8, 14, 8, 59))).toBe(false)
  })

  it('est vrai à partir de lundi 9h', () => {
    expect(isRecapReady(new Date(2026, 8, 14, 9, 0))).toBe(true)
  })

  it('est vrai bien après', () => {
    expect(isRecapReady(new Date(2026, 8, 19, 12, 0))).toBe(true)
  })
})

describe('computeRecapStats', () => {
  it('retourne des stats vides pour une liste vide', () => {
    const stats = computeRecapStats([])
    expect(stats.total).toBe(0)
    expect(stats.daysAttended).toBe(0)
    expect(stats.byCategory).toEqual([])
    expect(stats.topVenue).toBeNull()
    expect(stats.first).toBeNull()
    expect(stats.last).toBeNull()
  })

  it('compte le total, les jours distincts et la répartition par catégorie', () => {
    const events = [
      makeEvent({ id: 'a', day: 'ven', start: '20:00', category: 'concert', venue: 'Le Parasol' }),
      makeEvent({ id: 'b', day: 'sam', start: '18:00', category: 'concert', venue: 'Le Parasol' }),
      makeEvent({ id: 'c', day: 'sam', start: '21:00', category: 'bal', venue: 'La Scène Solaire' }),
    ]
    const stats = computeRecapStats(events)

    expect(stats.total).toBe(3)
    expect(stats.daysAttended).toBe(2)
    expect(stats.byCategory).toEqual([
      { category: 'concert', label: 'Concerts', count: 2 },
      { category: 'bal', label: 'Bals', count: 1 },
    ])
  })

  it('identifie le lieu le plus fréquenté', () => {
    const events = [
      makeEvent({ id: 'a', venue: 'Le Parasol' }),
      makeEvent({ id: 'b', venue: 'Le Parasol' }),
      makeEvent({ id: 'c', venue: 'Le Village' }),
    ]
    const stats = computeRecapStats(events)
    expect(stats.topVenue).toEqual({ venue: 'Le Parasol', count: 2 })
  })

  it('retourne le premier et le dernier événement selon l\'ordre chronologique', () => {
    const events = [
      makeEvent({ id: 'late', day: 'dim', start: '15:00' }),
      makeEvent({ id: 'early', day: 'ven', start: '18:00' }),
      makeEvent({ id: 'middle', day: 'sam', start: '20:00' }),
    ]
    const stats = computeRecapStats(events)
    expect(stats.first?.id).toBe('early')
    expect(stats.last?.id).toBe('late')
  })
})

describe('buildRecapSlides', () => {
  it('ne retourne que l\'intro et un écran vide sans favoris', () => {
    const slides = buildRecapSlides(computeRecapStats([]))
    expect(slides.map((s) => s.kind)).toEqual(['intro', 'empty'])
  })

  it('construit toutes les diapositives quand les données sont disponibles', () => {
    const events = [
      makeEvent({ id: 'early', day: 'ven', start: '18:00', category: 'concert', venue: 'Le Parasol' }),
      makeEvent({ id: 'late', day: 'dim', start: '15:00', category: 'bal', venue: 'Le Village' }),
    ]
    const stats = computeRecapStats(events)
    const slides = buildRecapSlides(stats)

    expect(slides.map((s) => s.kind)).toEqual([
      'intro',
      'total',
      'venue',
      'category',
      'first',
      'last',
      'outro',
    ])
  })

  it('n\'ajoute pas de diapositive "last" en doublon quand il n\'y a qu\'un seul favori', () => {
    const stats = computeRecapStats([makeEvent({ id: 'solo' })])
    const slides = buildRecapSlides(stats)

    expect(slides.filter((s) => s.kind === 'last')).toHaveLength(0)
    expect(slides.filter((s) => s.kind === 'first')).toHaveLength(1)
  })
})
