import { useEffect, useRef, useState } from 'react'
import type { Day, FestEvent } from '../types'
import {
  byTime,
  DAY_LONG,
  DAYS,
  eventEndDate,
  formatRange,
  isAllDay,
  isEventOngoing,
} from '../lib/schedule'
import { downloadIcs } from '../lib/ics'
import { FIST_PATH, FIST_VIEWBOX, FistButton } from '../components/FistButton'
import { ReminderBanner } from '../components/ReminderBanner'
import { GroupPanel } from '../components/GroupPanel'
import { FriendChips, PresenceButton } from '../components/GroupBadges'
import type { ReminderStatus } from '../hooks/useReminders'
import type { GroupApi } from '../hooks/useGroup'
import { useNow } from '../hooks/useNow'
import * as Sentry from '@sentry/react'
import eventsData from '../data/events.json'

const events = eventsData as FestEvent[]
const SHOW_FRIENDS_KEY = 'fdh26-show-friends-favorites'

function loadShowFriends(): boolean {
  return localStorage.getItem(SHOW_FRIENDS_KEY) !== 'false'
}

interface TimelineTabProps {
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  reminderStatus: ReminderStatus
  onEnableReminders: () => void
  groupApi: GroupApi
  initialJoinCode: string | null
  scrollToken: number
}

export function TimelineTab({
  favorites,
  onToggleFavorite,
  reminderStatus,
  onEnableReminders,
  groupApi,
  initialJoinCode,
  scrollToken,
}: TimelineTabProps) {
  const [showFriends, setShowFriends] = useState(loadShowFriends)
  const now = useNow()

  const toggleShowFriends = () =>
    setShowFriends((prev) => {
      const next = !prev
      localStorage.setItem(SHOW_FRIENDS_KEY, String(next))
      return next
    })

  const groupPanel = (
    <GroupPanel
      group={groupApi.group}
      others={groupApi.others}
      onCreate={groupApi.create}
      onJoin={groupApi.join}
      onLeave={groupApi.leave}
      initialJoinCode={initialJoinCode}
      showFriends={showFriends}
      onToggleShowFriends={toggleShowFriends}
    />
  )

  // Seuls mes favoris partent dans l'agenda : les événements des amis sont
  // affichés pour se repérer, pas pour encombrer mon calendrier.
  const exportToCalendar = () => {
    const mine = events.filter((e) => favorites.has(e.id)).sort(byTime)
    downloadIcs(mine)
    Sentry.metrics.count('calendar.export', 1, { attributes: { count: mine.length } })
  }

  const friendFavoriteIds = groupApi.group && showFriends ? groupApi.friendsByEvent.keys() : []
  const visibleIds = new Set([...favorites, ...friendFavoriteIds])
  const list = events.filter((e) => visibleIds.has(e.id)).sort(byTime)

  const itemRefs = useRef(new Map<string, HTMLLIElement>())

  useEffect(() => {
    const now = Date.now()
    // Les animations en continu commencent tôt et finissent tard : sans ce filtre,
    // elles captent le scroll toute la journée au lieu de l'événement en cours.
    const upcoming = list.filter((e) => eventEndDate(e).getTime() > now)
    const next = upcoming.find((e) => !isAllDay(e)) ?? upcoming[0]
    const target = next && itemRefs.current.get(next.id)
    target?.scrollIntoView({ block: 'start' })
    // Se redéclenche au (re)montage de l'onglet, et aussi quand on clique sur l'onglet
    // alors qu'on y est déjà (scrollToken change à chaque clic sur "Ma timeline").
  }, [scrollToken])

  if (list.length === 0) {
    return (
      <section className="timeline-empty" aria-label="Ma timeline">
        {groupPanel}
        <svg
          viewBox={FIST_VIEWBOX}
          className="empty-fist"
          aria-hidden="true"
          focusable="false"
        >
          <path d={FIST_PATH} />
        </svg>
        <h2>Ta timeline est vide</h2>
        <p>
          Lève le poing sur un concert, un débat ou une conférence dans le
          Programme pour le retrouver ici, dans l'ordre du week-end.
        </p>
      </section>
    )
  }

  const byDay = DAYS.map((d) => ({
    day: d.key as Day,
    items: list.filter((e) => e.day === d.key),
  })).filter((g) => g.items.length > 0)

  return (
    <section aria-label="Ma timeline">
      {groupPanel}
      <ReminderBanner
        status={reminderStatus}
        enable={onEnableReminders}
        favoritesCount={favorites.size}
      />
      {favorites.size > 0 && (
        <div className="calendar-export">
          <button type="button" className="calendar-export-btn" onClick={exportToCalendar}>
            Ajouter mes favoris à mon agenda
          </button>
          <p className="calendar-export-hint">
            Récupère un fichier à ouvrir pour l'ajouter à ton agenda — il apparaîtra
            ensuite sur ta montre, avec un rappel 15 min avant. Retirer un favori
            ici n'efface pas l'événement de l'agenda.
          </p>
        </div>
      )}
      {byDay.map((group) => (
        <div key={group.day} className="tl-day">
          <h2 className={`tl-day-title day-${group.day}`}>{DAY_LONG[group.day]}</h2>
          <ol className="tl-list">
            {group.items.map((e) => {
              const isMine = favorites.has(e.id)
              const friends = groupApi.friendsByEvent.get(e.id) ?? []
              const canCheckIn = groupApi.group !== null && isEventOngoing(e, now)
              const isHere = groupApi.myEventId === e.id
              return (
                <li
                  key={e.id}
                  ref={(el) => {
                    if (el) {
                      itemRefs.current.set(e.id, el)
                    } else {
                      itemRefs.current.delete(e.id)
                    }
                  }}
                  className={`tl-item cat-${e.category}${isMine ? '' : ' tl-item-friend'}`}
                >
                  <span className="tl-dot" aria-hidden="true" />
                  <div className="tl-content">
                    <span className="pill pill-time">{formatRange(e)}</span>
                    <h3 className="card-title">{e.title}</h3>
                    {e.artist && <p className="card-artist">{e.artist}</p>}
                    <p className="card-venue">{e.venue}</p>
                    {(friends.length > 0 || canCheckIn) && (
                      <div className="card-group-row">
                        {canCheckIn && (
                          <PresenceButton
                            here={isHere}
                            eventTitle={e.title}
                            onToggle={() => groupApi.checkIn(isHere ? null : e.id)}
                          />
                        )}
                        {friends.length > 0 && <FriendChips friends={friends} />}
                      </div>
                    )}
                  </div>
                  <FistButton
                    active={isMine}
                    title={e.title}
                    onToggle={() => onToggleFavorite(e.id)}
                  />
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </section>
  )
}
