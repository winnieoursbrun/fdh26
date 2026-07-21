import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decryptState, deriveGroupKeys, encryptState, type MemberState } from '../lib/group'
import { publishState } from '../lib/nostr'
import { useGroup } from './useGroup'

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
  ],
}))

// Fixture stable, qui se chevauche le vendredi à 17h30 : l'ouverture
// (17:00 – 18:30) et la nocturne du village (17:00 – 21:30).
const LARZAC = 'ouverture-ven-1700'
const NOCTURNE = 'village-ven-1700'
const DURING_BOTH = new Date(2026, 8, 11, 17, 30)
const AFTER_FESTIVAL = new Date(2026, 8, 15, 12, 0)

const subscriptions: {
  tag: string
  onEvent: (pubkey: string, content: string, createdAt: number) => void
}[] = []

vi.mock('../lib/nostr', () => ({
  generateSecretKey: () => new Uint8Array(32).fill(7),
  getPublicKey: () => 'my-pubkey',
  skToHex: (sk: Uint8Array) =>
    [...sk].map((b) => b.toString(16).padStart(2, '0')).join(''),
  skFromHex: () => new Uint8Array(32).fill(7),
  publishState: vi.fn(() => Promise.resolve()),
  subscribeGroup: vi.fn(
    (tag: string, onEvent: (pubkey: string, content: string, createdAt: number) => void) => {
      subscriptions.push({ tag, onEvent })
      return () => {}
    },
  ),
}))

function makeState(overrides: Partial<MemberState> = {}): MemberState {
  return {
    name: 'Max',
    favorites: ['ev-1'],
    updatedAt: 1000,
    ...overrides,
  }
}

async function sendFromFriend(
  code: string,
  pubkey: string,
  state: MemberState,
) {
  const { key } = await deriveGroupKeys(code)
  const payload = await encryptState(key, state)
  const sub = subscriptions[subscriptions.length - 1]
  act(() => {
    sub.onEvent(pubkey, payload, Math.floor(state.updatedAt / 1000))
  })
}

describe('useGroup', () => {
  beforeEach(() => {
    localStorage.clear()
    subscriptions.length = 0
    vi.clearAllMocks()
  })

  it('crée un groupe et le persiste', () => {
    const { result } = renderHook(() => useGroup(new Set()))
    let code = ''
    act(() => {
      code = result.current.create('Léa')
    })
    expect(code).toMatch(/^[A-Z]+-\d{2}$/)
    expect(result.current.group).toEqual({ code, name: 'Léa' })
    expect(JSON.parse(localStorage.getItem('fdh26-group') ?? '{}')).toMatchObject({
      code,
      name: 'Léa',
    })
  })

  it('reçoit et fusionne l’état d’un copain', async () => {
    const { result } = renderHook(() => useGroup(new Set()))
    let code = ''
    act(() => {
      code = result.current.create('Léa')
    })
    await waitFor(() => expect(subscriptions.length).toBeGreaterThan(0))

    await sendFromFriend(code, 'friend-pk', makeState())
    await waitFor(() => expect(result.current.others).toHaveLength(1))
    expect(result.current.friendsByEvent.get('ev-1')).toEqual([
      { name: 'Max', here: false },
    ])
  })

  it('ignore un état plus vieux que le cache', async () => {
    const { result } = renderHook(() => useGroup(new Set()))
    let code = ''
    act(() => {
      code = result.current.create('Léa')
    })
    await waitFor(() => expect(subscriptions.length).toBeGreaterThan(0))

    await sendFromFriend(code, 'friend-pk', makeState({ favorites: ['ev-9'], updatedAt: 2000 }))
    await waitFor(() => expect(result.current.others).toHaveLength(1))
    await sendFromFriend(code, 'friend-pk', makeState({ favorites: ['ev-1'], updatedAt: 1000 }))

    await waitFor(() =>
      expect(result.current.others[0]?.favorites).toEqual(['ev-9']),
    )
  })

  it('ignore un payload corrompu', async () => {
    const { result } = renderHook(() => useGroup(new Set()))
    act(() => {
      result.current.create('Léa')
    })
    await waitFor(() => expect(subscriptions.length).toBeGreaterThan(0))

    act(() => {
      subscriptions[0].onEvent('friend-pk', 'nimporte-quoi', 1)
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.others).toHaveLength(0)
  })

  it('exclut mon propre état renvoyé par le relais', async () => {
    const { result } = renderHook(() => useGroup(new Set()))
    let code = ''
    act(() => {
      code = result.current.create('Léa')
    })
    await waitFor(() => expect(subscriptions.length).toBeGreaterThan(0))

    await sendFromFriend(code, 'my-pubkey', makeState({ name: 'Léa' }))
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.others).toHaveLength(0)
  })

  it('retire un ami qui quitte et ses favoris de la timeline', async () => {
    const { result } = renderHook(() => useGroup(new Set()))
    let code = ''
    act(() => {
      code = result.current.create('Léa')
    })
    await waitFor(() => expect(subscriptions.length).toBeGreaterThan(0))

    await sendFromFriend(code, 'friend-pk', makeState({ updatedAt: 1000 }))
    await waitFor(() => expect(result.current.others).toHaveLength(1))
    expect(result.current.friendsByEvent.get('ev-1')).toEqual([
      { name: 'Max', here: false },
    ])

    await sendFromFriend(
      code,
      'friend-pk',
      makeState({ favorites: [], updatedAt: 2000, left: true }),
    )
    await waitFor(() => expect(result.current.others).toHaveLength(0))
    expect(result.current.friendsByEvent.get('ev-1')).toBeUndefined()
    expect(
      JSON.parse(localStorage.getItem('fdh26-group-members') ?? '{}'),
    ).not.toHaveProperty('friend-pk')
  })

  it('ignore un tombstone plus vieux que le cache', async () => {
    const { result } = renderHook(() => useGroup(new Set()))
    let code = ''
    act(() => {
      code = result.current.create('Léa')
    })
    await waitFor(() => expect(subscriptions.length).toBeGreaterThan(0))

    await sendFromFriend(code, 'friend-pk', makeState({ updatedAt: 2000 }))
    await waitFor(() => expect(result.current.others).toHaveLength(1))

    await sendFromFriend(
      code,
      'friend-pk',
      makeState({ favorites: [], updatedAt: 1000, left: true }),
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.others).toHaveLength(1)
  })

  it('publie un tombstone left: true en quittant le groupe', async () => {
    const { result } = renderHook(() => useGroup(new Set()))
    let code = ''
    act(() => {
      code = result.current.create('Léa')
    })
    act(() => {
      result.current.leave()
    })
    await waitFor(() => expect(vi.mocked(publishState)).toHaveBeenCalled())

    const [, , payload] = vi.mocked(publishState).mock.calls[0]
    const { key } = await deriveGroupKeys(code)
    expect(await decryptState(key, payload)).toMatchObject({ name: 'Léa', left: true })
  })

  it('recharge les membres depuis le cache local au remontage', async () => {
    const first = renderHook(() => useGroup(new Set()))
    let code = ''
    act(() => {
      code = first.result.current.create('Léa')
    })
    await waitFor(() => expect(subscriptions.length).toBeGreaterThan(0))
    await sendFromFriend(code, 'friend-pk', makeState())
    await waitFor(() => expect(first.result.current.others).toHaveLength(1))
    first.unmount()

    const second = renderHook(() => useGroup(new Set()))
    expect(second.result.current.others).toHaveLength(1)
    expect(second.result.current.friendsByEvent.get('ev-1')).toEqual([
      { name: 'Max', here: false },
    ])
  })

  it('quitter le groupe efface tout', async () => {
    const { result } = renderHook(() => useGroup(new Set()))
    act(() => {
      result.current.create('Léa')
    })
    act(() => {
      result.current.leave()
    })
    expect(result.current.group).toBeNull()
    expect(result.current.others).toHaveLength(0)
    expect(localStorage.getItem('fdh26-group')).toBeNull()
    expect(localStorage.getItem('fdh26-group-members')).toBeNull()
  })
})

describe('useGroup — présence « j’y suis »', () => {
  beforeEach(() => {
    localStorage.clear()
    subscriptions.length = 0
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(DURING_BOTH)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('checkIn persiste et ne garde qu’un seul événement à la fois', () => {
    const { result } = renderHook(() => useGroup(new Set()))
    act(() => {
      result.current.create('Léa')
    })

    act(() => {
      result.current.checkIn(LARZAC)
    })
    expect(result.current.myEventId).toBe(LARZAC)
    expect(localStorage.getItem('fdh26-group-at')).toBe(LARZAC)

    act(() => {
      result.current.checkIn(NOCTURNE)
    })
    expect(result.current.myEventId).toBe(NOCTURNE)
    expect(localStorage.getItem('fdh26-group-at')).toBe(NOCTURNE)

    act(() => {
      result.current.checkIn(null)
    })
    expect(result.current.myEventId).toBeNull()
    expect(localStorage.getItem('fdh26-group-at')).toBeNull()
  })

  it('une présence sur un événement terminé est purgée immédiatement', () => {
    vi.setSystemTime(AFTER_FESTIVAL)
    const { result } = renderHook(() => useGroup(new Set()))
    act(() => {
      result.current.create('Léa')
    })
    act(() => {
      result.current.checkIn(LARZAC)
    })
    expect(result.current.myEventId).toBeNull()
    expect(localStorage.getItem('fdh26-group-at')).toBeNull()
  })

  it('recharge ma présence depuis le stockage tant que l’événement est en cours', () => {
    localStorage.setItem('fdh26-group-at', LARZAC)
    const { result } = renderHook(() => useGroup(new Set()))
    expect(result.current.myEventId).toBe(LARZAC)
  })

  it('ignore une présence stockée dont l’événement est passé', () => {
    vi.setSystemTime(AFTER_FESTIVAL)
    localStorage.setItem('fdh26-group-at', LARZAC)
    const { result } = renderHook(() => useGroup(new Set()))
    expect(result.current.myEventId).toBeNull()
  })

  it('marque l’ami présent (here) sur son événement en cours, même hors favoris', async () => {
    const { result } = renderHook(() => useGroup(new Set()))
    let code = ''
    act(() => {
      code = result.current.create('Léa')
    })
    await waitFor(() => expect(subscriptions.length).toBeGreaterThan(0))

    await sendFromFriend(code, 'friend-pk', makeState({ favorites: ['ev-1'], at: LARZAC }))
    await waitFor(() => expect(result.current.others).toHaveLength(1))
    expect(result.current.friendsByEvent.get(LARZAC)).toEqual([
      { name: 'Max', here: true },
    ])
    expect(result.current.friendsByEvent.get('ev-1')).toEqual([
      { name: 'Max', here: false },
    ])
  })

  it('n’affiche pas une présence d’ami sur un événement terminé', async () => {
    vi.setSystemTime(AFTER_FESTIVAL)
    const { result } = renderHook(() => useGroup(new Set()))
    let code = ''
    act(() => {
      code = result.current.create('Léa')
    })
    await waitFor(() => expect(subscriptions.length).toBeGreaterThan(0))

    await sendFromFriend(code, 'friend-pk', makeState({ favorites: [], at: LARZAC }))
    await waitFor(() => expect(result.current.others).toHaveLength(1))
    expect(result.current.friendsByEvent.get(LARZAC)).toBeUndefined()
  })

  it('quitter le groupe efface aussi ma présence', () => {
    const { result } = renderHook(() => useGroup(new Set()))
    act(() => {
      result.current.create('Léa')
    })
    act(() => {
      result.current.checkIn(LARZAC)
    })
    act(() => {
      result.current.leave()
    })
    expect(result.current.myEventId).toBeNull()
    expect(localStorage.getItem('fdh26-group-at')).toBeNull()
  })
})
