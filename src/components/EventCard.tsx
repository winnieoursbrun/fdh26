import { useState } from 'react'
import type { FestEvent } from '../types'
import { CATEGORY_LABEL, formatRange } from '../lib/schedule'
import { eventImageUrl } from '../lib/images'
import { FistButton } from './FistButton'
import { FriendChips, PresenceButton } from './GroupBadges'
import type { FriendPresence } from '../hooks/useGroup'

interface EventCardProps {
  event: FestEvent
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  friends?: FriendPresence[]
  /** Fourni quand on est en groupe et que l'événement est en cours : bouton « J'y suis ». */
  presence?: { here: boolean; onToggle: () => void } | null
}

export function EventCard({
  event,
  isFavorite,
  onToggleFavorite,
  friends,
  presence,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false)
  const details = event.description ?? event.subtype
  const image = eventImageUrl(event.image)

  return (
    <article className={`card cat-${event.category}`}>
      <div className="card-pills">
        <span className="pill pill-time">{formatRange(event)}</span>
        <span className="pill pill-cat">
          {event.subtype ?? CATEGORY_LABEL[event.category]}
        </span>
      </div>
      <div className="card-body">
        {image && (
          <img
            className="card-thumb"
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        )}
        <div className="card-text">
          <h3 className="card-title">{event.title}</h3>
          {event.artist && <p className="card-artist">{event.artist}</p>}
          <p className="card-venue">{event.venue}</p>
          {event.speakers && event.speakers.length > 0 && (
            <p className="card-speakers-line">{event.speakers.join(' · ')}</p>
          )}
        </div>
        <FistButton
          active={isFavorite}
          title={event.title}
          onToggle={() => onToggleFavorite(event.id)}
        />
      </div>
      {((friends && friends.length > 0) || presence) && (
        <div className="card-group-row">
          {presence && (
            <PresenceButton
              here={presence.here}
              eventTitle={event.title}
              onToggle={presence.onToggle}
            />
          )}
          {friends && friends.length > 0 && <FriendChips friends={friends} />}
        </div>
      )}
      {event.description && (
        <>
          <button
            type="button"
            className="card-more"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Réduire' : 'En savoir plus'}
          </button>
          {expanded && (
            <>
              <p className="card-desc">{details}</p>
              {event.copyright && (
                <p className="card-credit">Photo {event.copyright}</p>
              )}
              {event.recommendations && (
                <div className="card-recs">
                  <span className="card-recs-label">Tu aimeras si tu aimes</span>
                  <div className="card-recs-tags">
                    {event.recommendations.map((r) => (
                      <span key={r} className="card-recs-tag">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </article>
  )
}
