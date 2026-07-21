import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeWeatherCode, fetchFestivalWeather, isFestivalOver } from './weather'

describe('describeWeatherCode', () => {
  it('retourne le libellé et l\'icône pour un code connu', () => {
    expect(describeWeatherCode(0)).toEqual({ icon: '☀️', label: 'Ciel dégagé' })
    expect(describeWeatherCode(63)).toEqual({ icon: '🌧️', label: 'Pluie' })
  })

  it('retourne un repli pour un code inconnu', () => {
    expect(describeWeatherCode(9999)).toEqual({ icon: '🌡️', label: 'Météo inconnue' })
  })
})

describe('isFestivalOver', () => {
  it('est faux pendant le festival', () => {
    expect(isFestivalOver(new Date(2026, 8, 12, 12, 0))).toBe(false)
  })

  it('est faux juste avant la fin du dernier jour', () => {
    expect(isFestivalOver(new Date(2026, 8, 13, 23, 0))).toBe(false)
  })

  it('est vrai après la fin du dernier jour', () => {
    expect(isFestivalOver(new Date(2026, 8, 14, 0, 0))).toBe(true)
  })
})

describe('fetchFestivalWeather', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('transforme la réponse Open-Meteo en tableau de prévisions par jour', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: {
          time: ['2026-07-17', '2026-07-18', '2026-07-19'],
          weathercode: [0, 61, 95],
          temperature_2m_max: [22.4, 19.1, 24.9],
          temperature_2m_min: [12.1, 11.6, 14.2],
          precipitation_probability_max: [5, 80, 40],
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await fetchFestivalWeather()

    expect(result).toEqual([
      { date: '2026-07-17', weatherCode: 0, tempMax: 22.4, tempMin: 12.1, precipitationProbability: 5 },
      { date: '2026-07-18', weatherCode: 61, tempMax: 19.1, tempMin: 11.6, precipitationProbability: 80 },
      { date: '2026-07-19', weatherCode: 95, tempMax: 24.9, tempMin: 14.2, precipitationProbability: 40 },
    ])
  })

  it('lève une erreur si la réponse n\'est pas ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    await expect(fetchFestivalWeather()).rejects.toThrow('Weather fetch failed: 500')
  })
})
