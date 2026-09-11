import { describe, expect, it } from 'vitest'
import {
  byTime,
  currentFestivalDay,
  eventDoneAt,
  eventEndDate,
  eventStartDate,
  formatRange,
  isAllDay,
  isEventOngoing,
  isPast,
  timeMinutes,
} from './schedule'
import type { Day, FestEvent } from '../types'

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

describe('timeMinutes', () => {
  it('convertit une heure de journée en minutes', () => {
    expect(timeMinutes('21:30')).toBe(21 * 60 + 30)
  })

  it('décale les heures après minuit pour les trier en fin de nuit', () => {
    expect(timeMinutes('00:30')).toBe(24 * 60 + 30)
    expect(timeMinutes('04:59')).toBe(28 * 60 + 59)
  })

  it('ne décale pas la frontière de 05:00', () => {
    expect(timeMinutes('05:00')).toBe(5 * 60)
  })
})

describe('byTime', () => {
  const at = (day: Day, start: string) => makeEvent({ day, start })

  it('trie par heure au sein du même jour', () => {
    const sorted = [at('sam', '21:00'), at('sam', '10:30')].sort(byTime)
    expect(sorted.map((e) => e.start)).toEqual(['10:30', '21:00'])
  })

  it("trie un créneau après minuit en fin de son jour de grille, avant le jour suivant", () => {
    const sorted = [at('sam', '10:00'), at('ven', '01:00'), at('ven', '23:30')].sort(byTime)
    expect(sorted.map((e) => `${e.day} ${e.start}`)).toEqual([
      'ven 23:30',
      'ven 01:00',
      'sam 10:00',
    ])
  })

  it('trie les jours dans l’ordre ven < sam < dim', () => {
    const sorted = [at('dim', '10:00'), at('ven', '22:00'), at('sam', '15:00')].sort(byTime)
    expect(sorted.map((e) => e.day)).toEqual(['ven', 'sam', 'dim'])
  })
})

describe('formatRange', () => {
  it('formate début et fin avec des « h »', () => {
    expect(formatRange(makeEvent({ start: '21:00', end: '22:30' }))).toBe('21h00 – 22h30')
  })

  it('ne montre que le début quand il n’y a pas de fin', () => {
    expect(formatRange(makeEvent({ start: '21:00', end: null }))).toBe('21h00')
  })
})

describe('eventStartDate', () => {
  it('retourne la date calendaire du jour de grille pour un créneau normal', () => {
    const event = makeEvent({ day: 'sam', start: '21:00' })
    const result = eventStartDate(event)

    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(8) // septembre = index 8
    expect(result.getDate()).toBe(12)
    expect(result.getHours()).toBe(21)
    expect(result.getMinutes()).toBe(0)
  })

  it('bascule sur le jour calendaire suivant pour un créneau après minuit', () => {
    const event = makeEvent({ day: 'ven', start: '00:40' })
    const result = eventStartDate(event)

    expect(result.getDate()).toBe(12) // nuit de vendredi 11 -> samedi 12
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(40)
  })

  it('lève une erreur pour un jour inconnu', () => {
    const event = makeEvent({ day: 'lun' as Day })
    expect(() => eventStartDate(event)).toThrow('Unknown day: lun')
  })
})

describe('isAllDay', () => {
  it('repère une animation en continu sur toute la journée', () => {
    expect(isAllDay(makeEvent({ start: '10:00', end: '18:30' }))).toBe(true)
  })

  it('accepte pile 6 heures comme journée entière', () => {
    expect(isAllDay(makeEvent({ start: '10:00', end: '16:00' }))).toBe(true)
  })

  it('ne repère pas un créneau classique', () => {
    expect(isAllDay(makeEvent({ start: '21:00', end: '22:30' }))).toBe(false)
  })

  it('ne repère pas une nocturne de quelques heures', () => {
    expect(isAllDay(makeEvent({ day: 'ven', start: '17:00', end: '21:00' }))).toBe(false)
  })

  it('ne repère pas un événement sans horaire de fin', () => {
    expect(isAllDay(makeEvent({ end: null }))).toBe(false)
  })

  it('ne repère pas un set de nuit qui déborde après minuit', () => {
    expect(isAllDay(makeEvent({ start: '23:00', end: '01:00' }))).toBe(false)
  })
})

describe('eventEndDate', () => {
  it('retourne la fin le même jour pour un créneau normal', () => {
    const end = eventEndDate(makeEvent({ day: 'sam', start: '21:00', end: '22:30' }))
    expect(end.getDate()).toBe(12)
    expect(end.getHours()).toBe(22)
    expect(end.getMinutes()).toBe(30)
  })

  it('retourne la date de début quand il n’y a pas de fin', () => {
    const event = makeEvent({ day: 'sam', start: '21:00', end: null })
    expect(eventEndDate(event).getTime()).toBe(eventStartDate(event).getTime())
  })

  it('ajoute un jour quand la fin déborde après minuit', () => {
    const end = eventEndDate(makeEvent({ day: 'ven', start: '23:00', end: '01:00' }))
    expect(end.getDate()).toBe(12) // nuit de vendredi 11 -> samedi 12
    expect(end.getHours()).toBe(1)
  })

  it('ajoute un jour quand la fin est égale au début', () => {
    const end = eventEndDate(makeEvent({ day: 'ven', start: '21:00', end: '21:00' }))
    expect(end.getDate()).toBe(12)
  })

  it('garde début et fin le lendemain calendaire pour un créneau démarrant après minuit', () => {
    const event = makeEvent({ day: 'ven', start: '00:40', end: '01:40' })
    const start = eventStartDate(event)
    const end = eventEndDate(event)
    expect(start.getDate()).toBe(12)
    expect(end.getDate()).toBe(12)
    expect(end.getHours()).toBe(1)
    expect(end.getMinutes()).toBe(40)
  })
})

describe('isEventOngoing', () => {
  const event = makeEvent({ day: 'sam', start: '21:00', end: '22:30' })

  it('est vrai pendant l’événement', () => {
    expect(isEventOngoing(event, new Date(2026, 8, 12, 21, 0).getTime())).toBe(true)
    expect(isEventOngoing(event, new Date(2026, 8, 12, 22, 0).getTime())).toBe(true)
  })

  it('s’active 15 minutes avant le début', () => {
    expect(isEventOngoing(event, new Date(2026, 8, 12, 20, 45).getTime())).toBe(true)
    expect(isEventOngoing(event, new Date(2026, 8, 12, 20, 44).getTime())).toBe(false)
  })

  it('reste actif 15 minutes après la fin', () => {
    expect(isEventOngoing(event, new Date(2026, 8, 12, 22, 44).getTime())).toBe(true)
    expect(isEventOngoing(event, new Date(2026, 8, 12, 22, 45).getTime())).toBe(false)
  })

  it('donne une fenêtre d’une heure (plus la marge) aux événements sans horaire de fin', () => {
    const openEnded = makeEvent({ day: 'sam', start: '23:00', end: null })
    expect(isEventOngoing(openEnded, new Date(2026, 8, 12, 23, 30).getTime())).toBe(true)
    expect(isEventOngoing(openEnded, new Date(2026, 8, 13, 0, 14).getTime())).toBe(true)
    expect(isEventOngoing(openEnded, new Date(2026, 8, 13, 0, 15).getTime())).toBe(false)
  })

  it('suit la bascule après minuit du jour de grille', () => {
    const night = makeEvent({ day: 'ven', start: '00:40', end: '01:40' })
    expect(isEventOngoing(night, new Date(2026, 8, 12, 1, 0).getTime())).toBe(true)
    expect(isEventOngoing(night, new Date(2026, 8, 11, 1, 0).getTime())).toBe(false)
  })
})

describe('eventDoneAt / isPast', () => {
  it('utilise l’horaire de fin publié', () => {
    const e = makeEvent({ day: 'sam', start: '21:00', end: '22:00' })
    expect(eventDoneAt(e)).toBe(new Date(2026, 8, 12, 22, 0).getTime())
  })

  it('retient début + 1 h sans horaire de fin', () => {
    const e = makeEvent({ day: 'sam', start: '21:00', end: null })
    expect(eventDoneAt(e)).toBe(new Date(2026, 8, 12, 22, 0).getTime())
  })

  it('n’est pas passé pendant l’événement', () => {
    const e = makeEvent({ day: 'sam', start: '21:00', end: '22:00' })
    expect(isPast(e, new Date(2026, 8, 12, 21, 30).getTime())).toBe(false)
  })

  it('est passé dès la dernière minute écoulée', () => {
    const e = makeEvent({ day: 'sam', start: '21:00', end: '22:00' })
    expect(isPast(e, new Date(2026, 8, 12, 22, 0).getTime())).toBe(true)
  })

  it('n’est pas passé pour un set qui déborde après minuit', () => {
    const e = makeEvent({ day: 'sam', start: '23:00', end: '01:00' })
    expect(isPast(e, new Date(2026, 8, 13, 0, 30).getTime())).toBe(false)
  })
})

describe('currentFestivalDay', () => {
  it('reconnaît chaque jour du festival', () => {
    expect(currentFestivalDay(new Date(2026, 8, 11, 14, 0).getTime())).toBe('ven')
    expect(currentFestivalDay(new Date(2026, 8, 12, 14, 0).getTime())).toBe('sam')
    expect(currentFestivalDay(new Date(2026, 8, 13, 14, 0).getTime())).toBe('dim')
  })

  it('rattache la fin de nuit au jour de grille précédent', () => {
    expect(currentFestivalDay(new Date(2026, 8, 12, 2, 30).getTime())).toBe('ven')
  })

  it('bascule sur le jour suivant à 05:00', () => {
    expect(currentFestivalDay(new Date(2026, 8, 12, 5, 0).getTime())).toBe('sam')
  })

  it('retourne null hors festival', () => {
    expect(currentFestivalDay(new Date(2026, 8, 14, 12, 0).getTime())).toBeNull()
    expect(currentFestivalDay(new Date(2026, 7, 11, 12, 0).getTime())).toBeNull()
    expect(currentFestivalDay(new Date(2025, 8, 11, 12, 0).getTime())).toBeNull()
  })

  it('ne compte pas la nuit du dernier soir comme un jour de plus', () => {
    expect(currentFestivalDay(new Date(2026, 8, 14, 2, 0).getTime())).toBe('dim')
  })
})
