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
import { UmbrellaButton } from '../components/Umbrella'
import { ReminderBanner } from '../components/ReminderBanner'
import { GroupPanel } from '../components/GroupPanel'
import { FriendChips, PresenceButton } from '../components/GroupBadges'
import type { ReminderStatus } from '../hooks/useReminders'
import type { GroupApi } from '../hooks/useGroup'
import { useNow } from '../hooks/useNow'
import eventsData from '../data/events.json'

const events = eventsData as FestEvent[]
const SHOW_FRIENDS_KEY = 'pdj26-show-friends-favorites'

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
        <svg viewBox="0 0 24 24" className="empty-umbrella" aria-hidden="true">
          <path d="M12 2.5c-5.5 0-9.5 4-9.8 8.7 0 .3.3.55.6.4 1-.5 2.4-.8 3.4-.1.4.3.9.3 1.3 0 1.2-.9 2.6-.9 3.8 0 .4.3.9.3 1.3 0 1.2-.9 2.6-.9 3.8 0 .4.3.9.3 1.3 0 1-.7 2.4-.4 3.4.1.3.15.6-.1.6-.4C21.5 6.5 17.5 2.5 12 2.5Z" />
          <path
            d="M12 12v6.5a1.6 1.6 0 0 1-3.2 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <h2>Ta timeline est vide</h2>
        <p>
          Ouvre le parapluie d'un concert, d'un atelier ou d'une conférence dans le
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
                  <UmbrellaButton
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
