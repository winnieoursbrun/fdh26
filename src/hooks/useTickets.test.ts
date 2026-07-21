import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import jsQR from 'jsqr'
import { decodeQrFromFile, useTickets } from './useTickets'

vi.mock('jsqr', () => ({ default: vi.fn() }))

const jsQRMock = vi.mocked(jsQR)

describe('useTickets', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('démarre sans billet', () => {
    const { result } = renderHook(() => useTickets())
    expect(result.current.tickets).toEqual([])
  })

  it('relit les billets depuis localStorage', () => {
    const stored = [{ id: '1', label: 'Festival', value: 'QR-1' }]
    localStorage.setItem('fdh26-tickets', JSON.stringify(stored))
    const { result } = renderHook(() => useTickets())
    expect(result.current.tickets).toEqual(stored)
  })

  it('retombe sur une liste vide si le stockage est corrompu', () => {
    localStorage.setItem('fdh26-tickets', '{oops')
    const { result } = renderHook(() => useTickets())
    expect(result.current.tickets).toEqual([])
  })

  it('ajoute un billet et le persiste', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('0-0-0-0-0')
    const { result } = renderHook(() => useTickets())
    act(() => result.current.add('Festival', 'QR-FESTIVAL'))

    const expected = [{ id: '0-0-0-0-0', label: 'Festival', value: 'QR-FESTIVAL' }]
    expect(result.current.tickets).toEqual(expected)
    expect(JSON.parse(localStorage.getItem('fdh26-tickets') ?? '[]')).toEqual(expected)
  })

  it('renomme le billet ciblé sans toucher les autres', () => {
    localStorage.setItem(
      'fdh26-tickets',
      JSON.stringify([
        { id: '1', label: 'Festival', value: 'QR-1' },
        { id: '2', label: 'Camping', value: 'QR-2' },
      ]),
    )
    const { result } = renderHook(() => useTickets())
    act(() => result.current.rename('2', 'Camping 2 nuits'))

    expect(result.current.tickets.map((t) => t.label)).toEqual(['Festival', 'Camping 2 nuits'])
    expect(JSON.parse(localStorage.getItem('fdh26-tickets')!)[1].label).toBe('Camping 2 nuits')
  })

  it('supprime le billet ciblé et persiste', () => {
    localStorage.setItem(
      'fdh26-tickets',
      JSON.stringify([
        { id: '1', label: 'Festival', value: 'QR-1' },
        { id: '2', label: 'Camping', value: 'QR-2' },
      ]),
    )
    const { result } = renderHook(() => useTickets())
    act(() => result.current.remove('1'))

    expect(result.current.tickets.map((t) => t.id)).toEqual(['2'])
    expect(JSON.parse(localStorage.getItem('fdh26-tickets')!)).toHaveLength(1)
  })
})

describe('decodeQrFromFile', () => {
  let imageSize = { width: 800, height: 600 }
  const getImageData = vi.fn((_x: number, _y: number, w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4),
    width: w,
    height: h,
  }))

  class FakeFileReader {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    result: string | null = null
    error = null
    readAsDataURL() {
      this.result = 'data:image/png;base64,fake'
      queueMicrotask(() => this.onload?.())
    }
  }

  class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = 0
    height = 0
    set src(_value: string) {
      this.width = imageSize.width
      this.height = imageSize.height
      queueMicrotask(() => this.onload?.())
    }
  }

  beforeEach(() => {
    imageSize = { width: 800, height: 600 }
    vi.stubGlobal('FileReader', FakeFileReader)
    vi.stubGlobal('Image', FakeImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ drawImage: vi.fn(), getImageData }) as unknown as CanvasRenderingContext2D,
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    jsQRMock.mockReset()
    getImageData.mockClear()
  })

  const file = () => new File(['fake'], 'billet.png', { type: 'image/png' })

  it('retourne le texte décodé par jsQR', async () => {
    jsQRMock.mockReturnValue({ data: 'BILLET-123' } as ReturnType<typeof jsQR>)
    await expect(decodeQrFromFile(file())).resolves.toBe('BILLET-123')
  })

  it('rejette quand aucun QR code n’est détecté', async () => {
    jsQRMock.mockReturnValue(null)
    await expect(decodeQrFromFile(file())).rejects.toThrow(
      'QR code introuvable dans cette photo',
    )
  })

  it('rejette quand le canvas est indisponible', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(decodeQrFromFile(file())).rejects.toThrow('canvas indisponible')
  })

  it('redimensionne les grandes photos à 1600 px max avant décodage', async () => {
    imageSize = { width: 3200, height: 1600 }
    jsQRMock.mockReturnValue({ data: 'BILLET-123' } as ReturnType<typeof jsQR>)
    await decodeQrFromFile(file())

    expect(getImageData).toHaveBeenCalledWith(0, 0, 1600, 800)
    expect(jsQRMock).toHaveBeenCalledWith(expect.any(Uint8ClampedArray), 1600, 800)
  })

  it('ne redimensionne pas les photos déjà petites', async () => {
    jsQRMock.mockReturnValue({ data: 'BILLET-123' } as ReturnType<typeof jsQR>)
    await decodeQrFromFile(file())
    expect(getImageData).toHaveBeenCalledWith(0, 0, 800, 600)
  })
})
