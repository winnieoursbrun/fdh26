import { DAYS } from './schedule'

// Coordonnées approximatives de Champrepus (Manche) — suffisant pour une prévision
// météo (pas de variation notable à cette échelle). À affiner si besoin via un
// service de géocodage.
const LATITUDE = 48.83
const LONGITUDE = -1.25

export const FESTIVAL_DATES = DAYS.map((d) => `2026-07-${d.date}`)

export type DayWeather = {
  date: string
  weatherCode: number
  tempMax: number
  tempMin: number
  precipitationProbability: number
}

type OpenMeteoResponse = {
  daily: {
    time: string[]
    weathercode: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: number[]
  }
}

export async function fetchFestivalWeather(): Promise<DayWeather[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(LATITUDE))
  url.searchParams.set('longitude', String(LONGITUDE))
  url.searchParams.set(
    'daily',
    'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  )
  url.searchParams.set('timezone', 'Europe/Paris')
  url.searchParams.set('start_date', FESTIVAL_DATES[0])
  url.searchParams.set('end_date', FESTIVAL_DATES[FESTIVAL_DATES.length - 1])

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Weather fetch failed: ${res.status}`)
  }
  const data = (await res.json()) as OpenMeteoResponse

  return data.daily.time.map((date, i) => ({
    date,
    weatherCode: data.daily.weathercode[i],
    tempMax: data.daily.temperature_2m_max[i],
    tempMin: data.daily.temperature_2m_min[i],
    precipitationProbability: data.daily.precipitation_probability_max[i],
  }))
}

// Codes météo WMO utilisés par Open-Meteo, réduits aux cas pertinents pour un
// festival en plein air.
const WEATHER_CODE_LABELS: Record<number, { icon: string; label: string }> = {
  0: { icon: '☀️', label: 'Ciel dégagé' },
  1: { icon: '🌤️', label: 'Peu nuageux' },
  2: { icon: '⛅', label: 'Partiellement nuageux' },
  3: { icon: '☁️', label: 'Couvert' },
  45: { icon: '🌫️', label: 'Brouillard' },
  48: { icon: '🌫️', label: 'Brouillard givrant' },
  51: { icon: '🌦️', label: 'Bruine légère' },
  53: { icon: '🌦️', label: 'Bruine' },
  55: { icon: '🌦️', label: 'Bruine dense' },
  61: { icon: '🌧️', label: 'Pluie légère' },
  63: { icon: '🌧️', label: 'Pluie' },
  65: { icon: '🌧️', label: 'Pluie forte' },
  71: { icon: '🌨️', label: 'Neige légère' },
  73: { icon: '🌨️', label: 'Neige' },
  75: { icon: '🌨️', label: 'Neige forte' },
  80: { icon: '🌦️', label: 'Averses légères' },
  81: { icon: '🌧️', label: 'Averses' },
  82: { icon: '⛈️', label: 'Averses violentes' },
  95: { icon: '⛈️', label: 'Orage' },
  96: { icon: '⛈️', label: 'Orage avec grêle' },
  99: { icon: '⛈️', label: 'Orage violent' },
}

export function describeWeatherCode(code: number): { icon: string; label: string } {
  return WEATHER_CODE_LABELS[code] ?? { icon: '🌡️', label: 'Météo inconnue' }
}

export function isFestivalOver(now: Date = new Date()): boolean {
  const lastDay = FESTIVAL_DATES[FESTIVAL_DATES.length - 1]
  const [year, month, day] = lastDay.split('-').map(Number)
  return now.getTime() > new Date(year, month - 1, day, 23, 59).getTime()
}
