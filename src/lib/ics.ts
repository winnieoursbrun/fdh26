import type { FestEvent } from '../types'
import { CATEGORY_LABEL, DAYS } from './schedule'

// Un agenda ne s'écrit pas depuis une page web : on produit un fichier .ics que
// l'OS propose d'ajouter. Tout est calculé ici à partir des chaînes `day`/`start`
// (et non d'un `Date` local) pour que le fichier soit identique quel que soit le
// fuseau de l'appareil — un festivalier peut très bien préparer sa timeline
// depuis un autre pays.

const PRODID = '-//fdh26//Fete de l Humanite 2026//FR'

// Les trois jours du festival tombent en heure d'été (CEST, UTC+2). Comme rien
// ne déborde hors de cette fenêtre, on convertit les heures locales en UTC avec
// ce décalage fixe plutôt que d'embarquer une VTIMEZONE complète.
const CEST_OFFSET_HOURS = 2

const DATE_BY_DAY = new Map(DAYS.map((d) => [d.key, Number(d.date)]))

/** Instant UTC correspondant à une heure de grille (`05:00` bascule au lendemain). */
function toUtc(day: FestEvent['day'], time: string, shiftDays = 0): Date {
  const date = DATE_BY_DAY.get(day)
  if (date === undefined) {
    throw new Error(`Unknown day: ${day}`)
  }
  const [hours, minutes] = time.split(':').map(Number)
  // Même bascule qu'ailleurs dans l'app : avant 05:00, on est sur la nuit du
  // jour de grille, donc sur la date calendaire suivante.
  const dayShift = (hours < 5 ? 1 : 0) + shiftDays
  return new Date(
    Date.UTC(2026, 8, date + dayShift, hours - CEST_OFFSET_HOURS, minutes),
  )
}

function stamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`
}

/** Échappement RFC 5545 : antislash, point-virgule, virgule et retours ligne. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Repli RFC 5545 à 75 octets : on compte en octets (UTF-8) et non en caractères,
 * sinon les accents font déborder la ligne chez les clients stricts.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) {
    return line
  }
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    // Les lignes de continuation commencent par une espace, qui compte aussi.
    const limit = out.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

/** Durée par défaut quand le programme ne publie pas d'horaire de fin. */
const DEFAULT_DURATION_MS = 60 * 60_000

// Même avance que les rappels de l'app (`useReminders`), pour que les deux
// canaux racontent la même chose.
const REMINDER_MINUTES = 15

function endFor(event: FestEvent): Date {
  const start = toUtc(event.day, event.start)
  if (!event.end) {
    return new Date(start.getTime() + DEFAULT_DURATION_MS)
  }
  const end = toUtc(event.day, event.end)
  // Une fin « avant » le début déborde sur la nuit suivante (23:00 → 01:00).
  return end <= start ? toUtc(event.day, event.end, 1) : end
}

function describe(event: FestEvent): string {
  const parts = [event.description?.trim(), event.speakers?.length ? `Avec ${event.speakers.join(', ')}` : null]
  return parts.filter(Boolean).join('\n\n')
}

function toVevent(event: FestEvent, now: Date): string[] {
  const lines = [
    'BEGIN:VEVENT',
    // L'UID est stable : réexporter ses favoris met à jour l'entrée existante
    // au lieu d'en créer une deuxième.
    `UID:${event.id}@fdh26`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(toUtc(event.day, event.start))}`,
    `DTEND:${stamp(endFor(event))}`,
    `SUMMARY:${escapeText(event.artist ? `${event.title} — ${event.artist}` : event.title)}`,
    `LOCATION:${escapeText(`${event.venue} — Fête de l'Humanité, Base 217, Le Plessis-Pâté`)}`,
    `CATEGORIES:${escapeText(event.subtype ?? CATEGORY_LABEL[event.category])}`,
  ]
  const description = describe(event)
  if (description) {
    lines.push(`DESCRIPTION:${escapeText(description)}`)
  }
  // Rappel porté par l'agenda lui-même : contrairement aux notifications de
  // l'app (de simples setTimeout, qui supposent l'app ouverte), il survit au
  // téléphone verrouillé et fait vibrer une Apple Watch appairée.
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:-PT${REMINDER_MINUTES}M`,
    `DESCRIPTION:${escapeText(event.title)}`,
    'END:VALARM',
  )
  lines.push('END:VEVENT')
  return lines
}

/**
 * Construit le calendrier .ics d'une liste d'événements.
 * `now` n'est là que pour rendre le DTSTAMP testable.
 */
export function buildIcs(events: FestEvent[], now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flatMap((event) => toVevent(event, now)),
    'END:VCALENDAR',
  ]
  // CRLF obligatoire, y compris en fin de fichier.
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

export const ICS_FILENAME = 'favoris-fete-humanite-2026.ics'

/**
 * Remet le calendrier à l'OS, qui propose alors de l'ajouter à l'agenda.
 * C'est la seule voie ouverte à une PWA : rien ici n'écrit dans l'agenda.
 */
export function downloadIcs(events: FestEvent[], filename = ICS_FILENAME): void {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // Safari ouvre le fichier de façon asynchrone : révoquer tout de suite le
  // ferait échouer silencieusement.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
