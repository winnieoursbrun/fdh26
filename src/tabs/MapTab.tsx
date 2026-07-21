import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { AddressCard } from '../components/AddressCard'
import { TicketsCard } from '../components/TicketsCard'
import type { Venue, VenueGroup } from '../types'
import venuesData from '../data/venues.json'

const venues = venuesData as Venue[]

const GROUPS: { key: VenueGroup; label: string }[] = [
  { key: 'programmation', label: 'Programmation' },
  { key: 'accueil', label: 'Accueil public' },
  { key: 'bienetre', label: 'Bien-être' },
  { key: 'vente', label: 'Boutique, bar & restauration' },
]

export function MapTab() {
  return (
    <section aria-label="Carte du site">
      <div className="map-frame">
        <TransformWrapper minScale={1} maxScale={6} doubleClick={{ mode: 'zoomIn' }}>
          <TransformComponent
            wrapperClass="map-wrapper"
            contentClass="map-content"
          >
            <img
              src={`${import.meta.env.BASE_URL}map.png`}
              alt="Plan du site du festival avec 23 points numérotés, détaillés dans la légende ci-dessous"
              draggable={false}
            />
          </TransformComponent>
        </TransformWrapper>
        <p className="map-hint">Pince ou double-tape pour zoomer</p>
      </div>

      <AddressCard />

      <TicketsCard />

      <div className="legend">
        {GROUPS.map((g) => (
          <details key={g.key} className={`legend-group legend-${g.key}`} open={g.key === 'programmation'}>
            <summary>{g.label}</summary>
            <ol className="legend-list">
              {venues
                .filter((v) => v.group === g.key)
                .map((v) => (
                  <li key={v.num}>
                    <span className="legend-num">{v.num}</span>
                    {v.name}
                  </li>
                ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  )
}
