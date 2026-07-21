import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useFavorites } from './useFavorites'

vi.mock('@sentry/react', () => ({
  metrics: { count: vi.fn() },
}))

vi.mock('../data/events.json', () => ({
  default: [
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
  ],
}))

import * as Sentry from '@sentry/react'

describe('useFavorites', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('démarre avec un set vide sans stockage', () => {
    const { result } = renderHook(() => useFavorites())
    expect(result.current.favorites.size).toBe(0)
  })

  it('relit les favoris depuis localStorage', () => {
    localStorage.setItem('fdh26-favorites', JSON.stringify(['a', 'b']))
    const { result } = renderHook(() => useFavorites())
    expect(result.current.favorites).toEqual(new Set(['a', 'b']))
  })

  it('retombe sur un set vide si le stockage est corrompu', () => {
    localStorage.setItem('fdh26-favorites', '{oops')
    const { result } = renderHook(() => useFavorites())
    expect(result.current.favorites.size).toBe(0)
  })

  it('ajoute un favori et le persiste', () => {
    const { result } = renderHook(() => useFavorites())
    act(() => result.current.toggle('larzac-ven-1700'))

    expect(result.current.favorites.has('larzac-ven-1700')).toBe(true)
    expect(JSON.parse(localStorage.getItem('fdh26-favorites') ?? '[]')).toEqual([
      'larzac-ven-1700',
    ])
  })

  it('retire un favori existant et le persiste', () => {
    localStorage.setItem('fdh26-favorites', JSON.stringify(['larzac-ven-1700']))
    const { result } = renderHook(() => useFavorites())
    act(() => result.current.toggle('larzac-ven-1700'))

    expect(result.current.favorites.size).toBe(0)
    expect(JSON.parse(localStorage.getItem('fdh26-favorites') ?? 'null')).toEqual([])
  })

  it('retourne une nouvelle instance de Set à chaque toggle', () => {
    const { result } = renderHook(() => useFavorites())
    const before = result.current.favorites
    act(() => result.current.toggle('a'))
    expect(result.current.favorites).not.toBe(before)
    expect(before.size).toBe(0)
  })

  it('émet une métrique avec les métadonnées du vrai événement', () => {
    const { result } = renderHook(() => useFavorites())
    act(() => result.current.toggle('massilia-ven-2135'))
    expect(Sentry.metrics.count).toHaveBeenCalledWith('favorite.toggle', 1, {
      attributes: {
        action: 'add',
        eventId: 'massilia-ven-2135',
        eventTitle: 'MASSILIA',
        category: 'concert',
      },
    })

    act(() => result.current.toggle('massilia-ven-2135'))
    expect(Sentry.metrics.count).toHaveBeenLastCalledWith(
      'favorite.toggle',
      1,
      expect.objectContaining({ attributes: expect.objectContaining({ action: 'remove' }) }),
    )
  })

  it('émet une métrique « unknown » pour un id hors programme', () => {
    const { result } = renderHook(() => useFavorites())
    act(() => result.current.toggle('id-inconnu'))
    expect(Sentry.metrics.count).toHaveBeenCalledWith('favorite.toggle', 1, {
      attributes: {
        action: 'add',
        eventId: 'id-inconnu',
        eventTitle: 'id-inconnu',
        category: 'unknown',
      },
    })
  })
})
