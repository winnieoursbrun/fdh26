import { afterEach, describe, expect, it, vi } from 'vitest'

// MAPS_HREF est calculé au chargement du module : on stubbe le user-agent
// puis on réimporte une copie fraîche du module à chaque test.
async function loadAddress(userAgent: string) {
  vi.stubGlobal('navigator', { userAgent })
  vi.resetModules()
  return import('./address')
}

describe('MAPS_HREF', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('pointe vers Apple Plans sur iOS', async () => {
    const { ADDRESS, MAPS_HREF } = await loadAddress(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    )
    expect(MAPS_HREF).toBe(`https://maps.apple.com/?q=${encodeURIComponent(ADDRESS)}`)
  })

  it('utilise le schéma geo: partout ailleurs', async () => {
    const { ADDRESS, MAPS_HREF } = await loadAddress(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
    )
    expect(MAPS_HREF).toBe(`geo:0,0?q=${encodeURIComponent(ADDRESS)}`)
  })

  it('encode correctement l’adresse du site', async () => {
    const { ADDRESS, MAPS_HREF } = await loadAddress('Mozilla/5.0 (Linux; Android 14)')
    expect(ADDRESS).toBe('Base aérienne 217, 91220 Le Plessis-Pâté')
    expect(MAPS_HREF).toContain(encodeURIComponent('Base aérienne 217, 91220 Le Plessis-Pâté'))
  })
})
