import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MapTab } from './MapTab'
import type { Venue } from '../types'
import venuesData from '../data/venues.json'

const venues = venuesData as Venue[]

// La vraie lib mesure le DOM (dimensions, gestes) : impraticable en jsdom.
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TransformComponent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const GROUP_LABELS: Record<string, string> = {
  programmation: 'Scènes, villages & espaces',
  accueil: 'Accueil public',
  bienetre: 'Bien-être',
  vente: 'Boutique, bar & restauration',
}

// Les groupes sans aucune zone ne sont pas rendus. Les données officielles
// géolocalisent désormais les quatre groupes, mais le garde-fou reste utile.
const PRESENT_GROUPS = Object.keys(GROUP_LABELS).filter((key) =>
  venues.some((v) => v.group === key),
)

describe('MapTab', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('affiche le plan de l’édition 2026 par défaut', () => {
    render(<MapTab />)
    expect(screen.getByRole('img', { name: /Plan officiel 2026/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2026' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('bascule sur la vue d’ensemble, en signalant qu’elle date de 2024', () => {
    render(<MapTab />)
    fireEvent.click(screen.getByRole('button', { name: "Vue d'ensemble" }))

    expect(screen.getByRole('img', { name: /édition 2024/ })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Plan officiel 2026/ })).not.toBeInTheDocument()
    expect(screen.getByText(/celui de l'édition 2024/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    expect(screen.getByRole('img', { name: /Plan officiel 2026/ })).toBeInTheDocument()
  })

  it('affiche une légende par groupe non vide, seule « Programmation » ouverte', () => {
    const { container } = render(<MapTab />)
    const groups = [...container.querySelectorAll('details.legend-group')]
    expect(groups).toHaveLength(PRESENT_GROUPS.length)
    expect(groups.map((g) => g.querySelector('summary')?.textContent)).toEqual(
      PRESENT_GROUPS.map((key) => GROUP_LABELS[key]),
    )
    expect(groups.filter((g) => g.hasAttribute('open'))).toHaveLength(1)
    expect(container.querySelector('details.legend-programmation')).toHaveAttribute('open')
  })

  it('liste chaque point du plan dans le bon groupe de légende', () => {
    const { container } = render(<MapTab />)
    for (const key of PRESENT_GROUPS) {
      const label = GROUP_LABELS[key]
      const details = container.querySelector(`details.legend-${key}`)!
      const items = within(details as HTMLElement).getAllByRole('listitem')
      const expected = venues.filter((v) => v.group === key)
      expect(items, label).toHaveLength(expected.length)
      expect(items.map((li) => li.textContent)).toEqual(expected.map((v) => v.name))
    }
  })

  it('affiche la carte adresse avec le lien itinéraire', () => {
    render(<MapTab />)
    const link = screen.getByRole('link', { name: /Base aérienne 217/ })
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent('Base aérienne 217, 91220 Le Plessis-Pâté')),
    )
  })

  it('affiche la carte « Mes billets »', () => {
    render(<MapTab />)
    expect(screen.getByRole('region', { name: 'Mes billets' })).toBeInTheDocument()
  })
})
