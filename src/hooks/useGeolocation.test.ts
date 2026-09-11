import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGeolocation } from './useGeolocation'

vi.mock('@sentry/react', () => ({ metrics: { count: vi.fn() } }))

const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2

type SuccessFn = (p: GeolocationPosition) => void
type ErrorFn = (e: GeolocationPositionError) => void

let successCb: SuccessFn | null
let errorCb: ErrorFn | null
let watchPosition: ReturnType<typeof vi.fn>
let clearWatch: ReturnType<typeof vi.fn>

function fakePosition(lat: number, lng: number, accuracy = 12): GeolocationPosition {
  return {
    coords: { latitude: lat, longitude: lng, accuracy },
    timestamp: 1_760_000_000_000,
  } as GeolocationPosition
}

function fakeError(code: number): GeolocationPositionError {
  return { code, PERMISSION_DENIED, POSITION_UNAVAILABLE } as GeolocationPositionError
}

beforeEach(() => {
  successCb = null
  errorCb = null
  watchPosition = vi.fn((ok: SuccessFn, ko: ErrorFn) => {
    successCb = ok
    errorCb = ko
    return 42
  })
  clearWatch = vi.fn()
  vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('useGeolocation', () => {
  it('reste en veille tant qu’on n’a rien demandé', () => {
    const { result } = renderHook(() => useGeolocation())
    expect(result.current.status).toBe('idle')
    expect(result.current.position).toBeNull()
    // Aucune invite système tant que l'utilisateur n'a pas cliqué.
    expect(watchPosition).not.toHaveBeenCalled()
  })

  it('signale un appareil sans géolocalisation', () => {
    vi.stubGlobal('navigator', {})
    const { result } = renderHook(() => useGeolocation())
    expect(result.current.status).toBe('unsupported')
  })

  it('passe par « locating » puis livre la position', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())
    expect(result.current.status).toBe('locating')

    act(() => successCb!(fakePosition(48.607, 2.3472, 8)))
    expect(result.current.status).toBe('ok')
    expect(result.current.position).toEqual({
      lat: 48.607,
      lng: 2.3472,
      accuracy: 8,
      at: 1_760_000_000_000,
    })
  })

  it('suit les positions successives', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())
    act(() => successCb!(fakePosition(48.607, 2.3472)))
    act(() => successCb!(fakePosition(48.605, 2.3441)))
    expect(result.current.position?.lat).toBe(48.605)
  })

  it('retient un refus et relâche la montre', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())
    act(() => errorCb!(fakeError(PERMISSION_DENIED)))
    expect(result.current.status).toBe('denied')
    expect(clearWatch).toHaveBeenCalledWith(42)
  })

  it('distingue une position indisponible d’un refus', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())
    act(() => errorCb!(fakeError(POSITION_UNAVAILABLE)))
    expect(result.current.status).toBe('unavailable')
    // Pas de refus : on continue de guetter une position.
    expect(clearWatch).not.toHaveBeenCalled()
  })

  it('ne lance qu’une seule montre malgré des starts répétés', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => result.current.start())
    act(() => result.current.start())
    expect(watchPosition).toHaveBeenCalledTimes(1)
  })

  it('coupe le GPS au démontage', () => {
    const { result, unmount } = renderHook(() => useGeolocation())
    act(() => result.current.start())
    unmount()
    expect(clearWatch).toHaveBeenCalledWith(42)
  })
})
