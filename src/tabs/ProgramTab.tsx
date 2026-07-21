import { useState } from 'react'
import type { Category, Day, FestEvent } from '../types'
import { byTime, CATEGORIES, DAYS, isEventOngoing } from '../lib/schedule'
import { describeWeatherCode } from '../lib/weather'
import { useWeather } from '../hooks/useWeather'
import { useNow } from '../hooks/useNow'
import { EventCard } from '../components/EventCard'
import { ProgramComingSoon } from '../components/ProgramComingSoon'
import type { GroupApi } from '../hooks/useGroup'
import eventsData from '../data/events.json'

const events = eventsData as FestEvent[]

const DAY_STORAGE_KEY = 'fdh26-program-day'

function loadStoredDay(): Day {
  const stored = localStorage.getItem(DAY_STORAGE_KEY)
  return DAYS.some((d) => d.key === stored) ? (stored as Day) : 'ven'
}

interface ProgramTabProps {
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  groupApi: GroupApi
}

function ProgramGrid({ favorites, onToggleFavorite, groupApi }: ProgramTabProps) {
  const [day, setDay] = useState<Day>(loadStoredDay)
  const [category, setCategory] = useState<Category | 'all'>('all')
  const { days: weatherDays } = useWeather()
  const now = useNow()

  function selectDay(d: Day) {
    setDay(d)
    localStorage.setItem(DAY_STORAGE_KEY, d)
  }

  const list = events
    .filter((e) => e.day === day && (category === 'all' || e.category === category))
    .sort(byTime)

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
        {CATEGORIES.map((c) => (
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
        {list.length === 0
          ? 'Rien dans cette catégorie ce jour-là'
          : `${list.length} événement${list.length > 1 ? 's' : ''}`}
      </p>

      <div className="card-list">
        {list.map((e) => {
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
        })}
      </div>
    </section>
  )
}

export function ProgramTab(props: ProgramTabProps) {
  if (events.length === 0) {
    return <ProgramComingSoon />
  }
  return <ProgramGrid {...props} />
}
