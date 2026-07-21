import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { TimelineTab } from './TimelineTab'
import type { FriendPresence, GroupApi } from '../hooks/useGroup'
import type { FestEvent } from '../types'
import eventsData from '../data/events.json'

const events = eventsData as FestEvent[]

// Ids réels stables du programme (voir events.json)
const LARZAC = 'larzac-ven-1700' // ven 17:00 – 18:30
const MIOSSEC = 'miossec-ven-2135' // ven 21:35 – 22:35
const TWENDE = 'twende-pamoja-ven-0040' // nuit de vendredi, 00:40 – 01:40
const STANDS = 'stands-village-sam-1000' // sam 10:00 – 18:30

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

const chips = (names: string[], here = false) =>
  names.map((name) => ({ name, here }))

function renderTab(overrides: Partial<Parameters<typeof TimelineTab>[0]> = {}) {
  const onToggleFavorite = vi.fn()
  const props = {
    favorites: new Set<string>(),
    onToggleFavorite,
    reminderStatus: 'unsupported' as const,
    onEnableReminders: vi.fn(),
    groupApi: fakeGroupApi(),
    initialJoinCode: null,
    scrollToken: 0,
    ...overrides,
  }
  const utils = render(<TimelineTab {...props} />)
  return { onToggleFavorite, props, ...utils }
}

describe('TimelineTab — rendu', () => {
  beforeEach(() => {
    localStorage.clear()
    // On fige l'horloge avant le festival : rien n'est encore passé.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 10, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche l’état vide (avec le panneau groupe) sans favoris', () => {
    renderTab()
    expect(screen.getByText('Ta timeline est vide')).toBeInTheDocument()
    expect(screen.getByText('Entre copains')).toBeInTheDocument()
  })

  it('groupe les favoris par jour, triés chronologiquement', () => {
    const { container } = renderTab({ favorites: new Set([MIOSSEC, STANDS, LARZAC]) })

    const titles = [...container.querySelectorAll('h2.tl-day-title')].map((h) => h.textContent)
    expect(titles).toEqual(['Vendredi 17 juillet', 'Samedi 18 juillet'])

    const cards = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(cards).toEqual(['LARZAC !', 'MIOSSEC', 'Les stands du village'])
  })

  it('garde un créneau après minuit sous son jour de grille', () => {
    const { container } = renderTab({ favorites: new Set([TWENDE]) })
    const titles = [...container.querySelectorAll('h2.tl-day-title')].map((h) => h.textContent)
    expect(titles).toEqual(['Vendredi 17 juillet'])
  })

  it('remonte le toggle avec l’id de l’événement', () => {
    const { onToggleFavorite } = renderTab({ favorites: new Set([LARZAC]) })
    fireEvent.click(
      screen.getByRole('button', { name: 'Retirer « LARZAC ! » de ma timeline' }),
    )
    expect(onToggleFavorite).toHaveBeenCalledWith(LARZAC)
  })
})

describe('TimelineTab — favoris des copains', () => {
  const inGroup = (friendsByEvent: Map<string, FriendPresence[]>) =>
    fakeGroupApi({
      group: { code: 'PLUIE-42', name: 'Moi' },
      others: [{ name: 'Léa', favorites: [...friendsByEvent.keys()], updatedAt: 1 }],
      friendsByEvent,
    })

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 10, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fusionne les favoris des amis dans la timeline avec leur chip', () => {
    renderTab({
      favorites: new Set([LARZAC]),
      groupApi: inGroup(new Map([[MIOSSEC, chips(['Léa'])]])),
    })

    const friendItem = screen.getByRole('heading', { name: 'MIOSSEC' }).closest('li')
    expect(friendItem).toHaveClass('tl-item-friend')
    expect(within(friendItem!).getByText('Léa')).toHaveClass('friend-chip')
  })

  it('masque les favoris des amis quand le toggle est désactivé', () => {
    localStorage.setItem('pdj26-show-friends-favorites', 'false')
    renderTab({
      favorites: new Set([LARZAC]),
      groupApi: inGroup(new Map([[MIOSSEC, chips(['Léa'])]])),
    })
    expect(screen.queryByRole('heading', { name: 'MIOSSEC' })).not.toBeInTheDocument()
  })

  it('reste visible par défaut pour toute autre valeur stockée', () => {
    localStorage.setItem('pdj26-show-friends-favorites', 'n-importe-quoi')
    renderTab({
      favorites: new Set(),
      groupApi: inGroup(new Map([[MIOSSEC, chips(['Léa'])]])),
    })
    expect(screen.getByRole('heading', { name: 'MIOSSEC' })).toBeInTheDocument()
  })

  it('ne marque pas comme « ami » un événement qui est aussi mon favori', () => {
    renderTab({
      favorites: new Set([MIOSSEC]),
      groupApi: inGroup(new Map([[MIOSSEC, chips(['Léa'])]])),
    })
    const item = screen.getByRole('heading', { name: 'MIOSSEC' }).closest('li')
    expect(item).not.toHaveClass('tl-item-friend')
    expect(within(item!).getByText('Léa')).toBeInTheDocument()
  })

  it('ignore les favoris des amis hors groupe', () => {
    renderTab({
      favorites: new Set(),
      groupApi: fakeGroupApi({ friendsByEvent: new Map([[MIOSSEC, chips(['Léa'])]]) }),
    })
    expect(screen.getByText('Ta timeline est vide')).toBeInTheDocument()
  })
})

describe('TimelineTab — présence « j’y suis »', () => {
  const inGroup = (overrides: Partial<GroupApi> = {}) =>
    fakeGroupApi({ group: { code: 'PLUIE-42', name: 'Moi' }, ...overrides })

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    // Vendredi 22h00 : MIOSSEC (21:35 – 22:35) est en cours.
    vi.setSystemTime(new Date(2026, 6, 17, 22, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('propose « J’y suis » sur un événement en cours quand on est en groupe', () => {
    const groupApi = inGroup()
    renderTab({ favorites: new Set([LARZAC, MIOSSEC]), groupApi })

    const btn = screen.getByRole('button', {
      name: 'Dire à mon groupe que je suis à « MIOSSEC »',
    })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    expect(groupApi.checkIn).toHaveBeenCalledWith(MIOSSEC)

    // LARZAC ! est terminé depuis 18h30 : pas de bouton de présence.
    const larzacItem = screen.getByRole('heading', { name: 'LARZAC !' }).closest('li')
    expect(within(larzacItem!).queryByRole('button', { name: /je suis à/ })).toBeNull()
  })

  it('affiche « Tu y es » et se désactive au clic quand j’y suis déjà', () => {
    const groupApi = inGroup({ myEventId: MIOSSEC })
    renderTab({ favorites: new Set([MIOSSEC]), groupApi })

    const btn = screen.getByRole('button', {
      name: 'Ne plus signaler ma présence à « MIOSSEC »',
    })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveTextContent('Tu y es')
    fireEvent.click(btn)
    expect(groupApi.checkIn).toHaveBeenCalledWith(null)
  })

  it('ne propose pas la présence hors groupe', () => {
    renderTab({ favorites: new Set([MIOSSEC]), groupApi: fakeGroupApi() })
    expect(screen.queryByRole('button', { name: /je suis à/ })).toBeNull()
  })

  it('met en avant la pastille d’un ami présent sur l’événement', () => {
    const groupApi = inGroup({
      friendsByEvent: new Map([[MIOSSEC, [...chips(['Léa'], true), ...chips(['Max'])]]]),
    })
    renderTab({ favorites: new Set([MIOSSEC]), groupApi })

    expect(screen.getByText('Léa')).toHaveClass('friend-chip-here')
    expect(screen.getByText('Max')).toHaveClass('friend-chip')
    expect(screen.getByText('Max')).not.toHaveClass('friend-chip-here')
  })
})

describe('TimelineTab — auto-scroll vers le prochain événement', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const scrollSpy = () => vi.spyOn(Element.prototype, 'scrollIntoView')

  const scrolledTitle = (spy: ReturnType<typeof scrollSpy>, call = 0) => {
    const el = spy.mock.contexts[call] as HTMLElement
    return within(el.closest('li')!).getByRole('heading', { level: 3 }).textContent
  }

  it('scrolle vers le premier événement pas encore terminé', () => {
    // Vendredi 18h00 : LARZAC ! (fin 18h30) est encore en cours.
    vi.setSystemTime(new Date(2026, 6, 17, 18, 0))
    const spy = scrollSpy()
    renderTab({ favorites: new Set([LARZAC, MIOSSEC]) })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ block: 'start' })
    expect(scrolledTitle(spy)).toBe('LARZAC !')
  })

  it('passe à l’événement suivant quand le premier est terminé', () => {
    vi.setSystemTime(new Date(2026, 6, 17, 19, 0))
    const spy = scrollSpy()
    renderTab({ favorites: new Set([LARZAC, MIOSSEC]) })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(scrolledTitle(spy)).toBe('MIOSSEC')
  })

  it('ne scrolle pas quand tout le festival est passé', () => {
    vi.setSystemTime(new Date(2026, 6, 21, 12, 0))
    const spy = scrollSpy()
    renderTab({ favorites: new Set([LARZAC, MIOSSEC]) })

    expect(spy).not.toHaveBeenCalled()
  })

  it('se redéclenche quand scrollToken change, pas sur un simple re-render', () => {
    vi.setSystemTime(new Date(2026, 6, 17, 18, 0))
    const spy = scrollSpy()
    const { rerender, props } = renderTab({ favorites: new Set([LARZAC]) })
    expect(spy).toHaveBeenCalledTimes(1)

    rerender(<TimelineTab {...props} scrollToken={0} />)
    expect(spy).toHaveBeenCalledTimes(1)

    rerender(<TimelineTab {...props} scrollToken={1} />)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('TimelineTab — cohérence des données de test', () => {
  it('les ids utilisés existent toujours dans events.json', () => {
    for (const id of [LARZAC, MIOSSEC, TWENDE, STANDS]) {
      expect(events.some((e) => e.id === id), id).toBe(true)
    }
  })
})
