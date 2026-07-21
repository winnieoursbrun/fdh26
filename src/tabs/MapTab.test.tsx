import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
  programmation: 'Programmation',
  accueil: 'Accueil public',
  bienetre: 'Bien-être',
  vente: 'Boutique, bar & restauration',
}

describe('MapTab', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('affiche le plan du site avec son texte alternatif', () => {
    render(<MapTab />)
    expect(
      screen.getByRole('img', { name: /Plan schématique et indicatif du site avec 14 points/ }),
    ).toBeInTheDocument()
  })

  it('affiche une légende par groupe, seule « Programmation » ouverte', () => {
    const { container } = render(<MapTab />)
    const groups = [...container.querySelectorAll('details.legend-group')]
    expect(groups).toHaveLength(4)
    expect(groups.map((g) => g.querySelector('summary')?.textContent)).toEqual(
      Object.values(GROUP_LABELS),
    )
    expect(groups.filter((g) => g.hasAttribute('open'))).toHaveLength(1)
    expect(container.querySelector('details.legend-programmation')).toHaveAttribute('open')
  })

  it('liste chaque point du plan dans le bon groupe de légende', () => {
    const { container } = render(<MapTab />)
    for (const [key, label] of Object.entries(GROUP_LABELS)) {
      const details = container.querySelector(`details.legend-${key}`)!
      const items = within(details as HTMLElement).getAllByRole('listitem')
      const expected = venues.filter((v) => v.group === key)
      expect(items, label).toHaveLength(expected.length)
      expect(items.map((li) => li.textContent)).toEqual(
        expected.map((v) => `${v.num}${v.name}`),
      )
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
