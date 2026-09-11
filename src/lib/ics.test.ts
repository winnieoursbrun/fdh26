import { describe, expect, it, vi } from 'vitest'
import { buildIcs, downloadIcs } from './ics'
import type { FestEvent } from '../types'

const NOW = new Date('2026-09-10T12:00:00Z')

function makeEvent(overrides: Partial<FestEvent> = {}): FestEvent {
  return {
    id: 'kneecap-ven-2200',
    title: 'Kneecap',
    artist: null,
    day: 'ven',
    start: '22:00',
    end: '23:20',
    venue: 'Scène Angela Davis',
    category: 'concert',
    subtype: 'Rap',
    description: null,
    ...overrides,
  }
}

function lines(ics: string): string[] {
  return ics.split('\r\n')
}

function valueOf(ics: string, key: string): string | undefined {
  return lines(ics)
    .find((l) => l.startsWith(`${key}:`))
    ?.slice(key.length + 1)
}

describe('buildIcs', () => {
  it('enveloppe les événements dans un VCALENDAR terminé par CRLF', () => {
    const ics = buildIcs([makeEvent()], NOW)
    expect(lines(ics)[0]).toBe('BEGIN:VCALENDAR')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('VERSION:2.0')
  })

  it('convertit les heures de grille en UTC (CEST = UTC+2)', () => {
    const ics = buildIcs([makeEvent()], NOW)
    expect(valueOf(ics, 'DTSTART')).toBe('20260911T200000Z')
    expect(valueOf(ics, 'DTEND')).toBe('20260911T212000Z')
  })

  it('bascule au lendemain un horaire de fin de nuit', () => {
    // 00:40 le « vendredi » de grille, c'est le samedi 12 à 00:40 (donc 22:40 UTC le 11).
    const ics = buildIcs([makeEvent({ start: '00:40', end: '01:40' })], NOW)
    expect(valueOf(ics, 'DTSTART')).toBe('20260911T224000Z')
    expect(valueOf(ics, 'DTEND')).toBe('20260911T234000Z')
  })

  it('fait déborder une fin antérieure au début sur la nuit suivante', () => {
    const ics = buildIcs([makeEvent({ start: '23:00', end: '01:00' })], NOW)
    expect(valueOf(ics, 'DTSTART')).toBe('20260911T210000Z')
    expect(valueOf(ics, 'DTEND')).toBe('20260911T230000Z')
  })

  it('donne une heure aux événements sans horaire de fin publié', () => {
    const ics = buildIcs([makeEvent({ end: null })], NOW)
    expect(valueOf(ics, 'DTEND')).toBe('20260911T210000Z')
  })

  it('donne un UID stable par événement, pour ne pas dupliquer au réexport', () => {
    const once = buildIcs([makeEvent()], NOW)
    const twice = buildIcs([makeEvent()], new Date('2026-09-11T08:00:00Z'))
    expect(valueOf(once, 'UID')).toBe('kneecap-ven-2200@fdh26')
    expect(valueOf(twice, 'UID')).toBe(valueOf(once, 'UID'))
    expect(valueOf(twice, 'DTSTAMP')).not.toBe(valueOf(once, 'DTSTAMP'))
  })

  it('accole l’artiste au titre quand il est renseigné', () => {
    const ics = buildIcs([makeEvent({ title: 'MASSILIA', artist: 'Massilia Sound System' })], NOW)
    expect(valueOf(ics, 'SUMMARY')).toBe('MASSILIA — Massilia Sound System')
  })

  it('échappe les caractères réservés du format', () => {
    const ics = buildIcs(
      [makeEvent({ title: 'Débat ; théâtre, cinéma', description: 'Ligne 1\nLigne 2' })],
      NOW,
    )
    expect(valueOf(ics, 'SUMMARY')).toBe('Débat \\; théâtre\\, cinéma')
    expect(ics).toContain('Ligne 1\\nLigne 2')
  })

  it('replie les lignes trop longues en comptant les octets', () => {
    const ics = buildIcs([makeEvent({ description: 'é'.repeat(200) })], NOW)
    const encoder = new TextEncoder()
    for (const line of lines(ics)) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
    // Les continuations commencent par une espace : le contenu reste reconstituable.
    expect(ics).toContain('\r\n ')
  })

  it('reprend les intervenant·es dans la description', () => {
    const ics = buildIcs([makeEvent({ speakers: ['Fabien Gay', 'Sophie Binet'] })], NOW)
    expect(ics.replace(/\r\n /g, '')).toContain('Avec Fabien Gay\\, Sophie Binet')
  })

  it('reprend le lieu et le genre', () => {
    const ics = buildIcs([makeEvent()], NOW)
    expect(ics.replace(/\r\n /g, '')).toContain('LOCATION:Scène Angela Davis —')
    expect(valueOf(ics, 'CATEGORIES')).toBe('Rap')
  })

  it('produit un calendrier vide mais valide sans favori', () => {
    const ics = buildIcs([], NOW)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('embarque un rappel 15 min avant, aligné sur celui de l’app', () => {
    const ics = buildIcs([makeEvent()], NOW)
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-PT15M')
    expect(ics).toContain('ACTION:DISPLAY')
    // L'alarme est bien à l'intérieur du VEVENT.
    const l = lines(ics)
    expect(l.indexOf('BEGIN:VALARM')).toBeGreaterThan(l.indexOf('BEGIN:VEVENT'))
    expect(l.indexOf('END:VALARM')).toBeLessThan(l.indexOf('END:VEVENT'))
  })
})

describe('downloadIcs', () => {
  it('remet un blob text/calendar à l’OS sous un nom de fichier explicite', () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:fake')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.fn()
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLElement
      if (tag === 'a') {
        el.click = click
      }
      return el
    })

    downloadIcs([makeEvent()])

    expect(click).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/calendar;charset=utf-8')
    expect(document.querySelector('a')).toBeNull() // le lien est retiré du DOM

    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})
