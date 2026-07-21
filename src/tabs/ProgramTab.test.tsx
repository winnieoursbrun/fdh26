import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ProgramTab } from './ProgramTab'
import { byTime } from '../lib/schedule'
import type { DayWeather } from '../lib/weather'
import type { FriendPresence, GroupApi } from '../hooks/useGroup'
import type { FestEvent } from '../types'
import eventsData from '../data/events.json'

vi.mock('../data/events.json', () => ({
  default: [
    {
      id: 'ouverture-ven-1700',
      title: "Discours d'ouverture",
      artist: null,
      day: 'ven',
      start: '17:00',
      end: '18:30',
      venue: 'La Grande Scène',
      category: 'conference',
      subtype: null,
      description: null,
    },
    {
      id: 'village-ven-1700',
      title: 'Nocturne du Village du Monde',
      artist: null,
      day: 'ven',
      start: '17:00',
      end: '21:30',
      venue: 'Le Village du Monde',
      category: 'atelier',
      subtype: null,
      description: null,
    },
    {
      id: 'massilia-ven-2135',
      title: 'MASSILIA',
      artist: 'Massilia Sound System',
      day: 'ven',
      start: '21:35',
      end: '22:35',
      venue: 'La Grande Scène',
      category: 'concert',
      subtype: null,
      description: null,
    },
    {
      id: 'nocturne-ven-0040',
      title: 'DJ Set Nocturne',
      artist: null,
      day: 'ven',
      start: '00:40',
      end: '01:40',
      venue: 'Le Bar',
      category: 'concert',
      subtype: null,
      description: null,
    },
    {
      id: 'village-sam-1000',
      title: 'Le Village du Monde',
      artist: null,
      day: 'sam',
      start: '10:00',
      end: '18:30',
      venue: 'Le Village du Monde',
      category: 'atelier',
      subtype: null,
      description: null,
    },
  ],
}))

const events = eventsData as FestEvent[]

let weatherDays: DayWeather[] = []

vi.mock('../hooks/useWeather', () => ({
  useWeather: () => ({ status: 'ok', days: weatherDays }),
}))

function fakeGroupApi(overrides: Partial<GroupApi> = {}): GroupApi {
  return {
    group: null,
    others: [],
    create: vi.fn(() => 'PLUIE-42'),
    join: vi.fn(),
    leave: vi.fn(),
    friendsByEvent: new Map<string, FriendPresence[]>(),
    myEventId: null,
    checkIn: vi.fn(),
    ...overrides,
  } as GroupApi
}

function renderTab(overrides: Partial<Parameters<typeof ProgramTab>[0]> = {}) {
  const onToggleFavorite = vi.fn()
  const utils = render(
    <ProgramTab
      favorites={new Set<string>()}
      onToggleFavorite={onToggleFavorite}
      groupApi={fakeGroupApi()}
      {...overrides}
    />,
  )
  return { onToggleFavorite, ...utils }
}

function renderedTitles() {
  return screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
}

describe('ProgramTab — choix du jour', () => {
  beforeEach(() => {
    localStorage.clear()
    weatherDays = []
  })

  it('ouvre sur vendredi sans stockage', () => {
    renderTab()
    expect(screen.getByRole('tab', { name: /Ven/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('rouvre sur le jour persisté', () => {
    localStorage.setItem('fdh26-program-day', 'sam')
    renderTab()
    expect(screen.getByRole('tab', { name: /Sam/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('retombe sur vendredi si la valeur stockée est invalide', () => {
    localStorage.setItem('fdh26-program-day', 'lundi')
    renderTab()
    expect(screen.getByRole('tab', { name: /Ven/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('active et persiste le jour cliqué', () => {
    renderTab()
    fireEvent.click(screen.getByRole('tab', { name: /Dim/ }))
    expect(screen.getByRole('tab', { name: /Dim/ })).toHaveAttribute('aria-selected', 'true')
    expect(localStorage.getItem('fdh26-program-day')).toBe('dim')
  })

  it('affiche la pastille météo du jour quand un forecast existe', () => {
    weatherDays = [
      {
        date: '2026-09-11',
        weatherCode: 0,
        tempMax: 24.6,
        tempMin: 14,
        precipitationProbability: 5,
      },
    ]
    renderTab()
    const ven = screen.getByRole('tab', { name: /Ven/ })
    const badge = within(ven).getByRole('img', { name: 'Ciel dégagé' })
    expect(badge).toHaveTextContent('25°')
  })
})

describe('ProgramTab — filtre par catégorie', () => {
  beforeEach(() => {
    localStorage.clear()
    weatherDays = []
  })

  it('affiche tous les événements du jour avec « Tout » actif par défaut', () => {
    renderTab()
    expect(screen.getByRole('button', { name: 'Tout' })).toHaveAttribute('aria-pressed', 'true')
    const expected = events.filter((e) => e.day === 'ven')
    expect(renderedTitles()).toHaveLength(expected.length)
  })

  it('ne garde que la catégorie cliquée', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Concerts' }))

    const expected = events
      .filter((e) => e.day === 'ven' && e.category === 'concert')
      .sort(byTime)
    expect(renderedTitles()).toEqual(expected.map((e) => e.title))
    expect(screen.getByRole('button', { name: 'Concerts' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('revient à « Tout » quand on re-clique le chip actif', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Concerts' }))
    fireEvent.click(screen.getByRole('button', { name: 'Concerts' }))

    expect(screen.getByRole('button', { name: 'Tout' })).toHaveAttribute('aria-pressed', 'true')
    expect(renderedTitles()).toHaveLength(events.filter((e) => e.day === 'ven').length)
  })

  it('bascule directement d’un chip à l’autre', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Concerts' }))
    fireEvent.click(screen.getByRole('button', { name: 'Conférences' }))

    const expected = events.filter((e) => e.day === 'ven' && e.category === 'conference')
    expect(renderedTitles()).toEqual(expected.map((e) => e.title))
  })
})

describe('ProgramTab — compteur et tri', () => {
  beforeEach(() => {
    localStorage.clear()
    weatherDays = []
  })

  it('affiche l’état vide pour un couple jour/catégorie sans événement', () => {
    // vendredi n'a aucun bal (vérifié sur les données réelles)
    expect(events.some((e) => e.day === 'ven' && e.category === 'bal')).toBe(false)
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Bals' }))
    expect(screen.getByText('Rien dans cette catégorie ce jour-là')).toBeInTheDocument()
  })

  it('accorde le compteur au singulier pour un seul événement', () => {
    expect(events.filter((e) => e.day === 'ven' && e.category === 'conference')).toHaveLength(1)
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Conférences' }))
    expect(screen.getByText('1 événement')).toBeInTheDocument()
  })

  it('accorde le compteur au pluriel', () => {
    const count = events.filter((e) => e.day === 'ven').length
    expect(count).toBeGreaterThan(1)
    renderTab()
    expect(screen.getByText(`${count} événements`)).toBeInTheDocument()
  })

  it('rend les événements dans l’ordre chronologique byTime (après-minuit en dernier)', () => {
    renderTab()
    const expected = events.filter((e) => e.day === 'ven').sort(byTime)
    expect(renderedTitles()).toEqual(expected.map((e) => e.title))
    // garde-fou : le vendredi contient bien un créneau après minuit
    expect(expected[expected.length - 1].start < '05:00').toBe(true)
  })
})

describe('ProgramTab — favoris', () => {
  beforeEach(() => {
    localStorage.clear()
    weatherDays = []
  })

  it('remonte le toggle avec l’id de l’événement cliqué', () => {
    const { onToggleFavorite } = renderTab()
    const first = events.filter((e) => e.day === 'ven').sort(byTime)[0]
    fireEvent.click(screen.getByRole('button', { name: `Ajouter « ${first.title} » à ma timeline` }))
    expect(onToggleFavorite).toHaveBeenCalledWith(first.id)
  })
})

describe('ProgramTab — présence « j’y suis »', () => {
  // MASSILIA, vendredi 21:35 – 22:35 (fixture ci-dessus)
  const MASSILIA = 'massilia-ven-2135'

  beforeEach(() => {
    localStorage.clear()
    weatherDays = []
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 11, 22, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('propose « J’y suis » sur l’événement en cours quand on est en groupe', () => {
    const groupApi = fakeGroupApi({ group: { code: 'PLUIE-42', name: 'Moi' } })
    renderTab({ groupApi })

    const btn = screen.getByRole('button', {
      name: 'Dire à mon groupe que je suis à « MASSILIA »',
    })
    fireEvent.click(btn)
    expect(groupApi.checkIn).toHaveBeenCalledWith(MASSILIA)
  })

  it('ne propose rien hors groupe', () => {
    renderTab()
    expect(screen.queryByRole('button', { name: /je suis à/ })).toBeNull()
  })
})
