import { useState } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { AddressCard } from '../components/AddressCard'
import { TicketsCard } from '../components/TicketsCard'
import type { Venue, VenueGroup } from '../types'
import venuesData from '../data/venues.json'

const venues = venuesData as Venue[]

const GROUPS: { key: VenueGroup; label: string }[] = [
  { key: 'programmation', label: 'Scènes, villages & espaces' },
  { key: 'accueil', label: 'Accueil public' },
  { key: 'bienetre', label: 'Bien-être' },
  { key: 'vente', label: 'Boutique, bar & restauration' },
]

// Deux plans officiels, chacun incomplet à sa façon : celui de 2026 est le bon
// millésime mais rogné à droite, celui de 2024 est complet et lisible mais
// périmé (pas de Scène Inter, camping ailleurs). On laisse le choix.
const PLANS = [
  {
    key: 'edition',
    tab: '2026',
    file: 'plan-officiel.webp',
    alt: "Plan officiel 2026 de la Fête de l'Humanité, rogné sur la droite",
    note: "Plan officiel de l'édition 2026. Il est rogné sur la droite (entrée Marcel Cachin, parkings) : bascule sur « Vue d'ensemble » pour le site entier, ou réfère-toi au plan affiché sur place.",
  },
  {
    key: 'ensemble',
    tab: "Vue d'ensemble",
    file: 'plan-2024.webp',
    alt: "Plan complet de la Fête de l'Humanité avec sa légende, édition 2024",
    note: "Plan complet, avec sa légende et les accès — mais c'est celui de l'édition 2024 : la Scène Inter n'y figure pas et le camping a bougé depuis. Pratique pour l'ensemble du site, pas pour repérer une scène.",
  },
] as const

type PlanKey = (typeof PLANS)[number]['key']

export function MapTab() {
  const [planKey, setPlanKey] = useState<PlanKey>('edition')
  const plan = PLANS.find((p) => p.key === planKey) ?? PLANS[0]

  return (
    <section aria-label="Carte du site">
      <div className="chip-row" role="group" aria-label="Choix du plan">
        {PLANS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`chip${planKey === p.key ? ' is-active' : ''}`}
            aria-pressed={planKey === p.key}
            onClick={() => setPlanKey(p.key)}
          >
            {p.tab}
          </button>
        ))}
      </div>

      <div className="map-frame">
        {/* La clé remet le zoom à plat quand on change de plan. */}
        <TransformWrapper
          key={plan.key}
          minScale={1}
          maxScale={6}
          doubleClick={{ mode: 'zoomIn' }}
        >
          <TransformComponent
            wrapperClass={`map-wrapper map-${plan.key}`}
            contentClass="map-content"
          >
            <img
              src={`${import.meta.env.BASE_URL}${plan.file}`}
              alt={plan.alt}
              draggable={false}
            />
          </TransformComponent>
        </TransformWrapper>
        <p className="map-hint">Pince ou double-tape pour zoomer</p>
      </div>
      <p className="map-disclaimer">{plan.note}</p>

      <AddressCard />

      <TicketsCard />

      {/* Les lieux ne sont pas numérotés : les repères des plans officiels ont
          leur propre codification, un numéro à nous n'y renverrait à rien. */}
      <div className="legend">
        {GROUPS.filter((g) => venues.some((v) => v.group === g.key)).map((g) => (
          <details
            key={g.key}
            className={`legend-group legend-${g.key}`}
            open={g.key === 'programmation'}
          >
            <summary>{g.label}</summary>
            <ul className="legend-list">
              {venues
                .filter((v) => v.group === g.key)
                .map((v) => (
                  <li key={v.num}>{v.name}</li>
                ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  )
}
