import { Fragment, useEffect, useRef, useState } from 'react'
import type { Category, Day, FestEvent } from '../types'
import {
  byTime,
  CATEGORIES,
  currentFestivalDay,
  DAYS,
  isAllDay,
  isEventOngoing,
  isPast,
} from '../lib/schedule'
import { describeWeatherCode } from '../lib/weather'
import { useWeather } from '../hooks/useWeather'
import { useNow } from '../hooks/useNow'
import { EventCard } from '../components/EventCard'
import { ProgramComingSoon } from '../components/ProgramComingSoon'
import type { GroupApi } from '../hooks/useGroup'
import eventsData from '../data/events.json'

const events = eventsData as FestEvent[]

// Le programme officiel n'alimente pas toutes les catégories du festival :
// on n'affiche que les chips qui filtrent réellement quelque chose.
const CHIP_CATEGORIES = CATEGORIES.filter((c) => events.some((e) => e.category === c.key))

const DAY_STORAGE_KEY = 'fdh26-program-day'
const DAY_PICKED_AT_KEY = 'fdh26-program-day-at'

function localDateKey(now: number): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// Sur place, rouvrir le programme sur le jour en cours vaut mieux que rouvrir
// sur le jour consulté la veille — sauf si on a soi-même choisi un autre jour
// dans la même journée (on prépare son dimanche le vendredi soir).
function loadStoredDay(now: number): Day {
  const stored = localStorage.getItem(DAY_STORAGE_KEY)
  const picked = DAYS.some((d) => d.key === stored) ? (stored as Day) : null
  const today = currentFestivalDay(now)
  if (today && localStorage.getItem(DAY_PICKED_AT_KEY) !== localDateKey(now)) {
    return today
  }
  return picked ?? today ?? 'ven'
}

interface ProgramTabProps {
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  groupApi: GroupApi
  /** Change à chaque clic sur l'onglet Programme : redéclenche le scroll vers « maintenant ». */
  scrollToken: number
}

function ProgramGrid({ favorites, onToggleFavorite, groupApi, scrollToken }: ProgramTabProps) {
  const [day, setDay] = useState<Day>(() => loadStoredDay(Date.now()))
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [allDayOpen, setAllDayOpen] = useState(false)
  const { days: weatherDays } = useWeather()
  const now = useNow()
  const nowRef = useRef<HTMLParagraphElement | null>(null)

  function selectDay(d: Day) {
    setDay(d)
    localStorage.setItem(DAY_STORAGE_KEY, d)
    localStorage.setItem(DAY_PICKED_AT_KEY, localDateKey(Date.now()))
  }

  const dayEvents = events.filter((e) => e.day === day)
  const list = dayEvents
    .filter((e) => category === 'all' || e.category === category)
    .sort(byTime)

  // Les animations en continu (12h – 20h…) ouvrent la journée et noieraient le
  // concert d'une heure qui commence maintenant : on les regroupe à la fin.
  const timed = list.filter((e) => !isAllDay(e))
  const allDay = list.filter((e) => isAllDay(e))
  const showAllDay = allDayOpen || timed.length === 0

  // Premier événement pas encore terminé : tout ce qui est au-dessus est passé.
  const nowIndex = currentFestivalDay(now) === day ? timed.findIndex((e) => !isPast(e, now)) : -1
  const showNowMarker = nowIndex > 0

  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: 'start' })
    // Au (re)montage de l'onglet et à chaque clic sur « Programme » alors qu'on
    // y est déjà ; pas à chaque minute, pour ne pas voler le scroll en lecture.
  }, [scrollToken, day, category])

  function renderCard(e: FestEvent) {
    const isHere = groupApi.myEventId === e.id
    return (
      <EventCard
        key={e.id}
        event={e}
        isFavorite={favorites.has(e.id)}
        onToggleFavorite={onToggleFavorite}
        friends={groupApi.friendsByEvent.get(e.id)}
        presence={
          groupApi.group !== null && isEventOngoing(e, now)
            ? {
                here: isHere,
                onToggle: () => groupApi.checkIn(isHere ? null : e.id),
              }
            : null
        }
      />
    )
  }

  return (
    <section aria-label="Programme">
      <div className="day-picker" role="tablist" aria-label="Jour">
        {DAYS.map((d) => {
          const weather = weatherDays.find((w) => w.date === `2026-09-${d.date}`)
          const { icon, label } = weather ? describeWeatherCode(weather.weatherCode) : { icon: null, label: '' }
          return (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={day === d.key}
              className={`day-btn day-${d.key}${day === d.key ? ' is-active' : ''}`}
              onClick={() => selectDay(d.key)}
            >
              <span className="day-name">{d.label}</span>
              <span className="day-date">{d.date}</span>
              {weather && (
                <span className="day-weather" role="img" aria-label={label}>
                  {icon} {Math.round(weather.tempMax)}°
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="chip-row" aria-label="Filtrer par type">
        <button
          type="button"
          className={`chip${category === 'all' ? ' is-active' : ''}`}
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
        >
          Tout
        </button>
        {CHIP_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`chip chip-${c.key}${category === c.key ? ' is-active' : ''}`}
            aria-pressed={category === c.key}
            onClick={() => setCategory(category === c.key ? 'all' : c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="list-count">
        {dayEvents.length === 0
          ? "Programme de ce jour pas encore disponible"
          : list.length === 0
            ? 'Rien dans cette catégorie ce jour-là'
            : `${list.length} événement${list.length > 1 ? 's' : ''}`}
      </p>

      <div className="card-list">
        {timed.map((e, i) => (
          <Fragment key={e.id}>
            {showNowMarker && i === nowIndex && (
              <p className="now-marker" ref={nowRef}>
                Maintenant
              </p>
            )}
            {renderCard(e)}
          </Fragment>
        ))}
      </div>

      {allDay.length > 0 && (
        <div className="allday-block">
          <button
            type="button"
            className="allday-toggle"
            aria-expanded={showAllDay}
            onClick={() => setAllDayOpen((v) => !v)}
          >
            En continu toute la journée ({allDay.length})
          </button>
          {showAllDay && <div className="card-list">{allDay.map(renderCard)}</div>}
        </div>
      )}
    </section>
  )
}

export function ProgramTab(props: ProgramTabProps) {
  if (events.length === 0) {
    return <ProgramComingSoon />
  }
  return <ProgramGrid {...props} />
}
